"""Tests for the modular image preprocessing pipeline and its individual steps."""

import io

import numpy as np
import pytest
from PIL import Image

from app.core.config import Settings
from app.images.preprocessing.pipeline import ImagePreprocessingPipeline
from app.images.preprocessing.steps import (
    PreprocessingError,
    enhance_contrast,
    enhance_leaf_features,
    load_image_rgb,
    normalize_background,
    normalize_color,
    reduce_noise,
    resize_image,
    to_tensor,
    validate_image,
)


def _make_leaf_like_image(width=300, height=200, seed=0) -> np.ndarray:
    """Synthesize a plausible green-leaf-on-background test image (no real photo needed)."""
    rng = np.random.default_rng(seed)
    image = np.full((height, width, 3), (245, 245, 240), dtype=np.uint8)  # light background
    # A rough elliptical "leaf" blob in shades of green.
    yy, xx = np.mgrid[0:height, 0:width]
    cy, cx = height // 2, width // 2
    ellipse = ((xx - cx) / (width * 0.35)) ** 2 + ((yy - cy) / (height * 0.35)) ** 2 <= 1
    noise = rng.integers(-10, 10, size=(height, width), endpoint=True)
    image[ellipse] = np.stack(
        [
            np.clip(60 + noise[ellipse], 0, 255),
            np.clip(140 + noise[ellipse], 0, 255),
            np.clip(50 + noise[ellipse], 0, 255),
        ],
        axis=-1,
    ).astype(np.uint8)
    return image


def _encode_jpeg(image: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


def test_load_image_rgb_decodes_valid_jpeg():
    raw = _encode_jpeg(_make_leaf_like_image())
    decoded = load_image_rgb(raw)
    assert decoded.shape == (200, 300, 3)
    assert decoded.dtype == np.uint8


def test_load_image_rgb_rejects_garbage_bytes():
    with pytest.raises(PreprocessingError):
        load_image_rgb(b"not an image")


def test_validate_image_rejects_too_small():
    tiny = np.zeros((5, 5, 3), dtype=np.uint8)
    with pytest.raises(PreprocessingError):
        validate_image(tiny, min_size=32)


def test_validate_image_rejects_blank_image():
    blank = np.full((100, 100, 3), 128, dtype=np.uint8)
    with pytest.raises(PreprocessingError):
        validate_image(blank)


def test_validate_image_accepts_normal_image():
    image = _make_leaf_like_image()
    validate_image(image)  # should not raise


def test_resize_image_produces_target_square_preserving_aspect():
    image = _make_leaf_like_image(width=400, height=200)
    resized = resize_image(image, target_size=256)
    assert resized.shape == (256, 256, 3)


def test_resize_image_upsamples_small_images():
    image = _make_leaf_like_image(width=50, height=40)
    resized = resize_image(image, target_size=256)
    assert resized.shape == (256, 256, 3)


def test_normalize_color_preserves_shape_and_dtype():
    image = _make_leaf_like_image()
    balanced = normalize_color(image)
    assert balanced.shape == image.shape
    assert balanced.dtype == np.uint8


def test_enhance_contrast_preserves_shape():
    image = _make_leaf_like_image()
    enhanced = enhance_contrast(image, clip_limit=2.0)
    assert enhanced.shape == image.shape


def test_reduce_noise_preserves_shape():
    image = _make_leaf_like_image()
    denoised = reduce_noise(image, strength=5)
    assert denoised.shape == image.shape


def test_normalize_background_preserves_shape():
    image = _make_leaf_like_image()
    result = normalize_background(image)
    assert result.shape == image.shape


def test_enhance_leaf_features_preserves_shape():
    image = _make_leaf_like_image()
    result = enhance_leaf_features(image)
    assert result.shape == image.shape


def test_to_tensor_produces_chw_float_in_unit_range():
    image = _make_leaf_like_image()
    tensor = to_tensor(image)
    assert tensor.shape == (3, image.shape[0], image.shape[1])
    assert tensor.dtype == np.float32
    assert tensor.min() >= 0.0
    assert tensor.max() <= 1.0


def test_full_pipeline_runs_end_to_end_and_produces_valid_tensor():
    raw = _encode_jpeg(_make_leaf_like_image())
    settings = Settings(PREPROCESS_TARGET_SIZE=224)
    pipeline = ImagePreprocessingPipeline(settings)

    result = pipeline.run(raw)

    assert result.processed_image.shape == (224, 224, 3)
    assert result.tensor.shape == (3, 224, 224)
    assert result.pil_image.size == (224, 224)
    assert result.total_ms > 0
    # Every named stage should have recorded a timing.
    expected_stages = {
        "decode",
        "validate_input",
        "resize",
        "normalize_color",
        "enhance_contrast",
        "reduce_noise",
        "normalize_background",
        "enhance_leaf_features",
        "validate_output",
        "to_tensor",
        "to_pil_image",
    }
    assert expected_stages.issubset(result.stage_timings_ms.keys())


def test_pipeline_rejects_corrupted_bytes():
    settings = Settings()
    pipeline = ImagePreprocessingPipeline(settings)
    with pytest.raises(PreprocessingError):
        pipeline.run(b"definitely not an image")
