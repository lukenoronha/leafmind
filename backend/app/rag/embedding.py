"""Embedding backend abstraction + the real sentence-transformers implementation.

`EmbeddingBackend` is the seam: everything above it (vectorstore, retriever,
ingestion pipeline) only talks to this protocol, mirroring
`app.inference.vlm.backend.VLMBackend`. `sentence-transformers`/`torch` are
imported lazily inside `SentenceTransformerBackend`, so importing this module
never requires those heavy dependencies unless embedding is actually invoked.
"""

import threading
from typing import Protocol

from loguru import logger

from app.core.config import Settings, get_settings


class EmbeddingBackendError(Exception):
    """Raised when the embedding backend fails to load or encode."""


class EmbeddingBackend(Protocol):
    """Minimal interface the RAG pipeline depends on for turning text into vectors."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Returns one dense vector per input text, in order."""
        ...

    @property
    def model_name(self) -> str:
        ...

    @property
    def dimension(self) -> int:
        ...


class SentenceTransformerBackend:
    """Loads a sentence-transformers model and encodes text into dense vectors.

    Model loading is expensive, so this is meant to be instantiated once and
    reused — see `get_embedding_backend()` for the process-wide lazy
    singleton, exactly like `get_vlm_backend()`.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._model = None
        self._lock = threading.Lock()
        self._dimension: int | None = None

    @property
    def model_name(self) -> str:
        return self._settings.RAG_EMBEDDING_MODEL_NAME

    @property
    def dimension(self) -> int:
        self._ensure_loaded()
        assert self._dimension is not None
        return self._dimension

    def warm_up(self) -> None:
        """Eagerly load the model now rather than on first `embed()` call.

        Used by `app.main`'s startup path when
        `Settings.RAG_EMBEDDING_LOAD_ON_STARTUP` is enabled. Idempotent.
        """
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return

            logger.info("Loading sentence-transformers model '{}'...", self.model_name)

            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise EmbeddingBackendError(
                    "sentence-transformers is not installed. Install the RAG extras "
                    "(`pip install -r requirements.txt`) to enable embedding."
                ) from exc

            configured_device = self._settings.RAG_EMBEDDING_DEVICE
            device = None if configured_device == "auto" else configured_device

            try:
                self._model = SentenceTransformer(self.model_name, device=device)
                self._dimension = self._model.get_sentence_embedding_dimension()
            except Exception as exc:
                raise EmbeddingBackendError(
                    f"Failed to load embedding model '{self.model_name}': {exc}"
                ) from exc

            logger.info("Embedding model loaded (dimension={})", self._dimension)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        self._ensure_loaded()

        try:
            vectors = self._model.encode(
                texts,
                batch_size=self._settings.RAG_EMBEDDING_BATCH_SIZE,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        except Exception as exc:
            raise EmbeddingBackendError(f"Embedding failed: {exc}") from exc

        return vectors.tolist()


_backend_lock = threading.Lock()
_backend_instance: SentenceTransformerBackend | None = None


def get_embedding_backend() -> SentenceTransformerBackend:
    """Process-wide lazy singleton — the model is loaded at most once, on first use."""
    global _backend_instance
    if _backend_instance is None:
        with _backend_lock:
            if _backend_instance is None:
                _backend_instance = SentenceTransformerBackend(get_settings())
    return _backend_instance
