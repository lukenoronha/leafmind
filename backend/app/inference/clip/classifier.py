"""Trained linear classifier on top of frozen CLIP embeddings.

`scripts/train_clip_classifier.py` fits this offline against the same
reference-image collection used for CLIP few-shot retrieval (see
`app.rag.image_retriever`), giving a dataset-specific classification signal
that generic zero-shot CLIP/Qwen reasoning doesn't have on its own. Lazily
loads the persisted model (`app/inference/clip/trained/`) so importing this
module — and therefore the rest of the app — never requires the trained
artifact to exist; callers get `None` if it hasn't been trained yet.
"""

import json
import threading
from pathlib import Path

from loguru import logger

from app.inference.clip.backend import CLIPBackend, get_clip_backend

_MODEL_DIR = Path("app/inference/clip/trained")
_MODEL_PATH = _MODEL_DIR / "classifier.joblib"
_LABELS_PATH = _MODEL_DIR / "classes.json"


class CLIPClassifierUnavailableError(Exception):
    """Raised when the trained classifier artifact doesn't exist yet."""


class TrainedCLIPClassifier:
    """Wraps the persisted logistic-regression head trained on CLIP embeddings."""

    def __init__(self, clip_backend: CLIPBackend | None = None):
        self._clip_backend = clip_backend or get_clip_backend()
        self._model = None
        self._labels: list[str] | None = None
        self._lock = threading.Lock()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return

            if not _MODEL_PATH.exists() or not _LABELS_PATH.exists():
                raise CLIPClassifierUnavailableError(
                    f"No trained classifier found at {_MODEL_PATH}. "
                    "Run `python -m scripts.train_clip_classifier` first."
                )

            import joblib

            self._model = joblib.load(_MODEL_PATH)
            self._labels = json.loads(_LABELS_PATH.read_text(encoding="utf-8"))
            logger.info("Loaded trained CLIP classifier ({} classes)", len(self._labels))

    def predict(self, pil_image) -> tuple[str, float]:
        """Returns (predicted_label, confidence) for a single image."""
        self._ensure_loaded()
        assert self._labels is not None

        [vector] = self._clip_backend.embed_images([pil_image])
        probabilities = self._model.predict_proba([vector])[0]
        best_index = probabilities.argmax()
        return self._labels[best_index], float(probabilities[best_index])


_classifier_lock = threading.Lock()
_classifier_instance: TrainedCLIPClassifier | None = None


def get_trained_clip_classifier() -> TrainedCLIPClassifier:
    """Process-wide lazy singleton, mirroring `get_clip_backend()`."""
    global _classifier_instance
    if _classifier_instance is None:
        with _classifier_lock:
            if _classifier_instance is None:
                _classifier_instance = TrainedCLIPClassifier()
    return _classifier_instance
