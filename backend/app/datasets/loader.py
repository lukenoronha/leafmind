"""Configurable loader for the LeafMind medicinal leaf image dataset.

Reads the class taxonomy from `metadata/classes.json` (see `datasets/README.md`
at the repository root) and resolves it against the raw image folders on disk.
The dataset root and subpaths are configurable via `Settings` so this loader
works regardless of where the dataset happens to live relative to the backend
(local dev, CI, a mounted volume in production).

This module only *reads* the dataset — nothing here mutates it. It is the
single source of truth for "what classes exist and what do we call them",
consumed by the inference pipeline for prompt construction and by anything
that needs to validate/display a predicted label.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from loguru import logger

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class DatasetClass:
    """A single species/class entry from the dataset taxonomy."""

    class_id: int
    training_label: Optional[str]
    folder_name: str
    status: str

    @property
    def display_name(self) -> str:
        """Human-readable species name, falling back to the raw folder name
        for classes still pending taxonomy verification."""
        return self.training_label or self.folder_name

    @property
    def is_verified(self) -> bool:
        return self.training_label is not None


class DatasetLoadError(Exception):
    """Raised when the dataset metadata or raw image folders cannot be read."""


class DatasetLoader:
    """Loads and caches the dataset's class taxonomy and per-class image paths."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._root = Path(settings.DATASET_ROOT)
        self._raw_dir = self._root / settings.DATASET_RAW_SUBDIR
        self._metadata_dir = self._root / settings.DATASET_METADATA_SUBDIR
        self._classes: Optional[list[DatasetClass]] = None

    @property
    def raw_dir(self) -> Path:
        return self._raw_dir

    def load_classes(self) -> list[DatasetClass]:
        """Load (and cache) the class taxonomy from `metadata/classes.json`."""
        if self._classes is not None:
            return self._classes

        classes_path = self._metadata_dir / "classes.json"
        if not classes_path.exists():
            raise DatasetLoadError(f"Dataset classes metadata not found at {classes_path}")

        try:
            payload = json.loads(classes_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise DatasetLoadError(f"Malformed classes.json at {classes_path}: {exc}") from exc

        classes = [
            DatasetClass(
                class_id=entry["class_id"],
                training_label=entry.get("training_label"),
                folder_name=entry["folder_name"],
                status=entry.get("status", "unknown"),
            )
            for entry in payload.get("classes", [])
        ]
        classes.sort(key=lambda c: c.class_id)

        logger.info(
            "Loaded dataset taxonomy: {} classes ({} verified) from {}",
            len(classes),
            sum(1 for c in classes if c.is_verified),
            classes_path,
        )
        self._classes = classes
        return classes

    def get_verified_class_names(self) -> list[str]:
        """Display names for classes with an approved scientific-name label.

        Used to build the closed candidate list handed to the VLM prompt —
        classes still pending manual taxonomy verification are excluded so the
        model isn't asked to choose between confirmed and unconfirmed names.
        """
        return [c.display_name for c in self.load_classes() if c.is_verified]

    def find_class_by_name(self, name: str) -> Optional[DatasetClass]:
        """Case-insensitive lookup of a class by its display name or folder name."""
        normalized = name.strip().lower()
        for candidate in self.load_classes():
            if candidate.display_name.lower() == normalized:
                return candidate
            if candidate.folder_name.lower() == normalized:
                return candidate
        return None

    def sample_image_paths(self, dataset_class: DatasetClass, limit: int = 5) -> list[Path]:
        """List up to `limit` raw image file paths for a given class (e.g. for
        reference-image lookups or dataset sanity checks)."""
        class_dir = self._raw_dir / dataset_class.folder_name
        if not class_dir.is_dir():
            return []
        images = sorted(p for p in class_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
        return images[:limit]

    def dataset_summary(self) -> dict:
        """Lightweight summary used by health/status-style diagnostics."""
        classes = self.load_classes()
        return {
            "total_classes": len(classes),
            "verified_classes": sum(1 for c in classes if c.is_verified),
            "raw_dir_exists": self._raw_dir.is_dir(),
            "raw_dir": str(self._raw_dir),
        }


@lru_cache
def get_dataset_loader() -> DatasetLoader:
    """Cached accessor — safe to use as a FastAPI dependency."""
    return DatasetLoader(get_settings())
