"""Orchestrates the modular image preprocessing pipeline.

Stage order matters: resize first (so every later step operates on a
consistent resolution), color/contrast/denoise/background/sharpen next (each
pure and independently swappable), then tensor conversion and a final
validation pass. Each stage's wall-clock time is recorded so the caller (the
image analysis service) can log granular preprocessing latency per step.
"""

import time
from dataclasses import dataclass, field

import numpy as np
from loguru import logger

from app.core.config import Settings, get_settings
from app.images.preprocessing.steps import (
    PreprocessingError,
    enhance_contrast,
    enhance_leaf_features,
    load_image_rgb,
    normalize_background,
    normalize_color,
    reduce_noise,
    resize_image,
    to_pil_image,
    to_tensor,
    validate_image,
)


@dataclass
class PreprocessingResult:
    """Structured output of the preprocessing pipeline.

    `processed_image` is the final enhanced RGB array (kept for optional
    persistence/inspection); `pil_image` is what gets handed to the VLM
    processor; `tensor` is the canonical [0, 1] CHW float array; `stage_timings_ms`
    breaks down latency per step for structured logging.
    """

    processed_image: np.ndarray
    pil_image: "object"
    tensor: np.ndarray
    stage_timings_ms: dict[str, float] = field(default_factory=dict)
    total_ms: float = 0.0


class ImagePreprocessingPipeline:
    """Composable pipeline: resize -> color norm -> contrast -> denoise ->
    background norm -> leaf enhancement -> tensor conversion -> validation."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()

    def run(self, raw_bytes: bytes) -> PreprocessingResult:
        timings: dict[str, float] = {}
        pipeline_start = time.perf_counter()

        image = self._timed(timings, "decode", load_image_rgb, raw_bytes)
        self._timed(timings, "validate_input", validate_image, image)

        image = self._timed(
            timings, "resize", resize_image, image, target_size=self._settings.PREPROCESS_TARGET_SIZE
        )
        image = self._timed(timings, "normalize_color", normalize_color, image)
        image = self._timed(
            timings,
            "enhance_contrast",
            enhance_contrast,
            image,
            clip_limit=self._settings.PREPROCESS_CONTRAST_CLIP_LIMIT,
        )
        image = self._timed(
            timings,
            "reduce_noise",
            reduce_noise,
            image,
            strength=self._settings.PREPROCESS_DENOISE_STRENGTH,
        )
        image = self._timed(timings, "normalize_background", normalize_background, image)
        image = self._timed(timings, "enhance_leaf_features", enhance_leaf_features, image)

        self._timed(timings, "validate_output", validate_image, image)

        tensor = self._timed(timings, "to_tensor", to_tensor, image)
        pil_image = self._timed(timings, "to_pil_image", to_pil_image, image)

        total_ms = (time.perf_counter() - pipeline_start) * 1000
        logger.bind(stage_timings_ms=timings, total_ms=round(total_ms, 2)).info(
            "Preprocessing pipeline completed in {:.2f}ms", total_ms
        )

        return PreprocessingResult(
            processed_image=image,
            pil_image=pil_image,
            tensor=tensor,
            stage_timings_ms=timings,
            total_ms=total_ms,
        )

    @staticmethod
    def _timed(timings: dict[str, float], name: str, func, *args, **kwargs):
        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
        except PreprocessingError:
            raise
        except Exception as exc:  # noqa: BLE001 - re-raised as a domain error with stage context
            raise PreprocessingError(f"Preprocessing stage '{name}' failed: {exc}") from exc
        timings[name] = round((time.perf_counter() - start) * 1000, 3)
        return result
