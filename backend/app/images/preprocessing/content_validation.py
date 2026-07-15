"""Cheap, model-free image quality heuristics — blur and lighting.

These run before the (more expensive) VLM leaf-assessment call so obviously
unusable photos are rejected without spending an inference call on them.
Both checks operate on the decoded RGB array before any of the enhancement
steps in `steps.py`, since those steps (denoise, sharpen, contrast) would
otherwise mask the very defects we're trying to detect.
"""

from dataclasses import dataclass

import cv2
import numpy as np


class ImageQualityError(ValueError):
    """Raised when an image fails a cheap quality heuristic (blur/lighting)."""


@dataclass(frozen=True)
class QualityMetrics:
    """Raw metric values behind a quality check, kept for logging/debugging."""

    sharpness: float
    brightness: float


def assess_quality(
    image: np.ndarray,
    *,
    blur_threshold: float,
    min_brightness: float,
    max_brightness: float,
) -> QualityMetrics:
    """Compute sharpness/brightness metrics and raise `ImageQualityError` if either fails.

    Sharpness is the variance of the Laplacian (a standard, cheap blur proxy —
    a blurry image has fewer sharp edges, hence lower high-frequency variance).
    Brightness is mean grayscale intensity, catching both underexposed
    (too-dark) and overexposed (washed-out) photos.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())

    metrics = QualityMetrics(sharpness=sharpness, brightness=brightness)

    if sharpness < blur_threshold:
        raise ImageQualityError(
            f"Image appears too blurry for reliable identification "
            f"(sharpness={sharpness:.1f}, minimum={blur_threshold:.1f})."
        )
    if brightness < min_brightness or brightness > max_brightness:
        raise ImageQualityError(
            f"Image lighting is out of range for reliable identification "
            f"(brightness={brightness:.1f}, expected {min_brightness:.1f}-{max_brightness:.1f})."
        )

    return metrics
