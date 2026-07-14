"""CLIP image-embedding backend, used for few-shot retrieval of visually
similar labeled reference images ahead of VLM classification.

Follows the same seam pattern as `app.inference.vlm.backend.VLMBackend` and
`app.rag.embedding.EmbeddingBackend`: callers only depend on the `CLIPBackend`
protocol, and `transformers`/`torch` are imported lazily inside
`HFCLIPBackend` so importing this module never requires those heavy
dependencies unless embedding is actually invoked.
"""

import threading
from typing import Protocol

from loguru import logger

from app.core.config import Settings, get_settings


class CLIPBackendError(Exception):
    """Raised when the CLIP backend fails to load or embed."""


class CLIPBackend(Protocol):
    """Minimal interface the image retriever depends on."""

    def embed_images(self, pil_images: list) -> list[list[float]]:
        """Embed a batch of PIL images. Returns one dense vector per image, in order."""
        ...

    @property
    def model_name(self) -> str:
        ...


class HFCLIPBackend:
    """Loads CLIP via Hugging Face `transformers` and embeds images.

    Model loading is expensive, so this is meant to be instantiated once and
    reused — see `get_clip_backend()` for the process-wide lazy singleton,
    mirroring `get_vlm_backend()`/`get_embedding_backend()`.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._model = None
        self._processor = None
        self._device = None
        self._lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._settings.CLIP_MODEL_NAME

    def warm_up(self) -> None:
        """Eagerly load the model now rather than on first `embed_images()` call.

        Used by `app.main`'s startup path when `Settings.CLIP_LOAD_ON_STARTUP`
        is enabled. Idempotent.
        """
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return

            logger.info("Loading CLIP model '{}'...", self.model_name)

            try:
                import torch
                from transformers import CLIPModel, CLIPProcessor
            except ImportError as exc:
                raise CLIPBackendError(
                    "transformers/torch are not installed. Install the ML extras "
                    "(`pip install -r requirements.txt`) to enable CLIP retrieval."
                ) from exc

            configured_device = self._settings.CLIP_DEVICE
            if configured_device == "auto":
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                self._device = configured_device

            try:
                self._model = CLIPModel.from_pretrained(self.model_name).to(self._device).eval()
                self._processor = CLIPProcessor.from_pretrained(self.model_name)
            except Exception as exc:
                raise CLIPBackendError(f"Failed to load CLIP model '{self.model_name}': {exc}") from exc

            logger.info("CLIP model loaded on device={}", self._device)

    def embed_images(self, pil_images: list) -> list[list[float]]:
        if not pil_images:
            return []

        self._ensure_loaded()

        try:
            import torch

            inputs = self._processor(images=pil_images, return_tensors="pt").to(self._device)
            with torch.no_grad():
                output = self._model.get_image_features(**inputs)
            # Newer `transformers` wraps the result in `BaseModelOutputWithPooling`
            # instead of returning the pooled tensor directly.
            features = output.pooler_output if hasattr(output, "pooler_output") else output
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            return features.cpu().tolist()
        except Exception as exc:
            raise CLIPBackendError(f"CLIP image embedding failed: {exc}") from exc


_backend_lock = threading.Lock()
_backend_instance: HFCLIPBackend | None = None


def get_clip_backend() -> HFCLIPBackend:
    """Process-wide lazy singleton — the model is loaded at most once, on first use."""
    global _backend_instance
    if _backend_instance is None:
        with _backend_lock:
            if _backend_instance is None:
                _backend_instance = HFCLIPBackend(get_settings())
    return _backend_instance
