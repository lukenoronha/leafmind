"""Individual, independently-testable image preprocessing steps.

Each function takes and returns an RGB `numpy.ndarray` (H, W, 3) of dtype
`uint8`, except `to_tensor` (which produces the final float tensor array) and
`validate_image` (which only inspects). Keeping every step a pure function
with this signature is what lets `ImagePreprocessingPipeline` compose them in
any order and lets each be unit tested in isolation.

All steps are deliberately conservative: the goal is to improve legibility of
leaf texture, venation, and color for the VLM without distorting the
botanical characteristics (true leaf color, margin shape, venation pattern)
that actually drive species identification.
"""

import numpy as np
from PIL import Image

try:
    import cv2

    _HAS_CV2 = True
except ImportError:  # pragma: no cover - opencv-python-headless is a hard dependency,
    _HAS_CV2 = False  # but the guard keeps this module importable in minimal environments.


class PreprocessingError(ValueError):
    """Raised when an image fails validation or a step receives bad input."""


def load_image_rgb(raw_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into an RGB uint8 array.

    Uses Pillow for decoding (broad format support, handles EXIF orientation)
    rather than cv2.imdecode, then hands off to numpy/cv2 for the rest of the
    pipeline.
    """
    try:
        from PIL import ImageOps

        with Image.open(_BytesLikeIO(raw_bytes)) as img:
            img = ImageOps.exif_transpose(img)  # normalize camera rotation metadata
            img = img.convert("RGB")
            return np.asarray(img)
    except Exception as exc:
        raise PreprocessingError(f"Could not decode image: {exc}") from exc


class _BytesLikeIO:
    """Minimal file-like wrapper so Pillow can open raw bytes without importing io at call sites."""

    def __init__(self, raw_bytes: bytes):
        import io

        self._buffer = io.BytesIO(raw_bytes)

    def __getattr__(self, item):
        return getattr(self._buffer, item)


def validate_image(image: np.ndarray, *, min_size: int = 32, max_size: int = 8000) -> None:
    """Reject images that are too small, too large, degenerate, or malformed.

    Raises `PreprocessingError` on any violation. This runs both before and
    after the pipeline: before, to reject obviously bad uploads early; after,
    to catch any step that unexpectedly produced NaNs/invalid shapes.
    """
    if image.ndim != 3 or image.shape[2] != 3:
        raise PreprocessingError(f"Expected an RGB image (H, W, 3); got shape {image.shape}")

    height, width = image.shape[:2]
    if height < min_size or width < min_size:
        raise PreprocessingError(
            f"Image too small ({width}x{height}); minimum is {min_size}x{min_size}"
        )
    if height > max_size or width > max_size:
        raise PreprocessingError(
            f"Image too large ({width}x{height}); maximum is {max_size}x{max_size}"
        )
    if not np.isfinite(image).all():
        raise PreprocessingError("Image contains non-finite pixel values.")

    # A near-blank (all-one-color) image is almost certainly not a usable leaf photo.
    if image.std() < 1.0:
        raise PreprocessingError("Image has near-zero variance — likely blank or corrupted.")


def resize_image(image: np.ndarray, *, target_size: int) -> np.ndarray:
    """Resize to a square `target_size x target_size`, preserving aspect ratio via
    letterboxing (padding) rather than stretching — stretching would distort
    leaf shape/proportions, which are diagnostic for species identification."""
    height, width = image.shape[:2]
    scale = target_size / max(height, width)
    new_width, new_height = max(1, round(width * scale)), max(1, round(height * scale))

    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    resized = cv2.resize(image, (new_width, new_height), interpolation=interpolation)

    canvas = np.full((target_size, target_size, 3), 255, dtype=np.uint8)  # white letterbox
    y_offset = (target_size - new_height) // 2
    x_offset = (target_size - new_width) // 2
    canvas[y_offset : y_offset + new_height, x_offset : x_offset + new_width] = resized
    return canvas


def normalize_color(image: np.ndarray) -> np.ndarray:
    """Gray-world white balance correction.

    Corrects color casts from mixed/artificial lighting (a common issue in
    phone photos of leaves) by scaling each channel so the channel means
    match the overall gray mean — without altering hue relationships enough
    to distort the leaf's true color, which matters for identification.
    """
    image_f = image.astype(np.float32)
    channel_means = image_f.reshape(-1, 3).mean(axis=0)
    gray_mean = channel_means.mean()

    # Guard against division by zero on a degenerate (near-black) channel.
    scale = gray_mean / np.clip(channel_means, 1e-6, None)
    # Dampen the correction so it nudges rather than overcorrects — preserves
    # authentic leaf coloration.
    scale = 1.0 + (scale - 1.0) * 0.5

    balanced = image_f * scale
    return np.clip(balanced, 0, 255).astype(np.uint8)


def enhance_contrast(image: np.ndarray, *, clip_limit: float = 2.0) -> np.ndarray:
    """CLAHE (Contrast Limited Adaptive Histogram Equalization) on luminance only.

    Operating in LAB space and equalizing only the L channel improves local
    contrast (making venation and margin detail more visible) while leaving
    the a/b color channels — and therefore the leaf's actual color — untouched.
    """
    lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)

    merged = cv2.merge((l_enhanced, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)


def reduce_noise(image: np.ndarray, *, strength: int = 5) -> np.ndarray:
    """Edge-preserving denoising (fastNlMeansDenoisingColored).

    Chosen over a simple Gaussian blur because it smooths sensor noise/JPEG
    artifacts while preserving edges — critical here since leaf vein and
    margin edges are themselves identification features we must not blur away.
    """
    return cv2.fastNlMeansDenoisingColored(
        image, None, h=strength, hColor=strength, templateWindowSize=7, searchWindowSize=21
    )


def normalize_background(image: np.ndarray) -> np.ndarray:
    """Softly suppress background clutter outside the dominant leaf region.

    Segments the likely leaf area using an HSV green/brown vegetation mask,
    then gently lightens (rather than removes) pixels outside that mask. This
    reduces distracting backgrounds (hands, soil, other foliage) while
    remaining reversible/soft so the model can still see true context and we
    never risk cropping into the leaf itself.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)

    # Broad vegetation range: greens through yellow-browns (covers healthy,
    # senescent, and browned leaf tissue) at moderate-to-high saturation/value.
    lower = np.array([15, 30, 30])
    upper = np.array([100, 255, 255])
    mask = cv2.inRange(hsv, lower, upper)

    # Morphological close to fill small holes (e.g. bright vein highlights)
    # inside the leaf mask, then a slight dilate so we don't clip the leaf edge.
    kernel = np.ones((7, 7), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.dilate(mask, kernel, iterations=1)

    if mask.sum() == 0:
        # No confident vegetation region detected — leave the image untouched
        # rather than risk washing out a valid but unusually-colored leaf.
        return image

    mask_f = (mask.astype(np.float32) / 255.0)[..., None]
    background_lightened = image.astype(np.float32) * 0.6 + 255 * 0.4
    result = image.astype(np.float32) * mask_f + background_lightened * (1 - mask_f)
    return np.clip(result, 0, 255).astype(np.uint8)


def enhance_leaf_features(image: np.ndarray) -> np.ndarray:
    """Sharpen fine leaf structure (venation, serration, texture) via unsharp masking.

    Applied last among the pixel-level enhancements so it operates on an
    already denoised, contrast-corrected image — sharpening noise or halos
    from earlier artifacts would otherwise be amplified here.
    """
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=3)
    sharpened = cv2.addWeighted(image, 1.5, blurred, -0.5, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def to_tensor(image: np.ndarray) -> np.ndarray:
    """Convert an HWC uint8 RGB image to a CHW float32 tensor scaled to [0, 1].

    This is the final step — the array shape/dtype expected by downstream ML
    consumers (the VLM processor performs its own model-specific
    normalization on top of this, so we only need a clean, canonical [0, 1]
    tensor here rather than baking in any particular model's mean/std).
    """
    chw = np.transpose(image, (2, 0, 1))
    return (chw.astype(np.float32) / 255.0).copy()


def to_pil_image(image: np.ndarray) -> Image.Image:
    """Convert the working RGB uint8 array back to a PIL Image for the VLM processor."""
    return Image.fromarray(image, mode="RGB")
