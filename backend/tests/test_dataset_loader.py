"""Tests for the configurable medicinal-leaf dataset loader."""

import json

import pytest

from app.core.config import Settings
from app.datasets.loader import DatasetLoader, DatasetLoadError


def _make_loader(tmp_path, classes_payload):
    metadata_dir = tmp_path / "metadata"
    metadata_dir.mkdir()
    (metadata_dir / "classes.json").write_text(json.dumps(classes_payload), encoding="utf-8")

    raw_dir = tmp_path / "raw" / "medicinal_leaf_images"
    raw_dir.mkdir(parents=True)

    settings = Settings(
        DATASET_ROOT=str(tmp_path),
        DATASET_RAW_SUBDIR="raw/medicinal_leaf_images",
        DATASET_METADATA_SUBDIR="metadata",
    )
    return DatasetLoader(settings)


_SAMPLE_CLASSES = {
    "classes": [
        {"class_id": 0, "training_label": "Pongamia_pinnata", "folder_name": "Pongamia_pinnata", "status": "active"},
        {"class_id": 1, "training_label": None, "folder_name": "Shathavari", "status": "manual_verification"},
        {"class_id": 2, "training_label": "Santalum_album", "folder_name": "Santalum_album", "status": "active"},
    ]
}


def test_load_classes_parses_and_sorts(tmp_path):
    loader = _make_loader(tmp_path, _SAMPLE_CLASSES)
    classes = loader.load_classes()
    assert [c.class_id for c in classes] == [0, 1, 2]
    assert classes[0].display_name == "Pongamia_pinnata"


def test_unverified_class_falls_back_to_folder_name(tmp_path):
    loader = _make_loader(tmp_path, _SAMPLE_CLASSES)
    classes = loader.load_classes()
    unverified = next(c for c in classes if c.class_id == 1)
    assert unverified.is_verified is False
    assert unverified.display_name == "Shathavari"


def test_get_verified_class_names_excludes_unverified(tmp_path):
    loader = _make_loader(tmp_path, _SAMPLE_CLASSES)
    names = loader.get_verified_class_names()
    assert "Shathavari" not in names
    assert "Pongamia_pinnata" in names
    assert "Santalum_album" in names


def test_find_class_by_name_case_insensitive(tmp_path):
    loader = _make_loader(tmp_path, _SAMPLE_CLASSES)
    found = loader.find_class_by_name("pongamia_pinnata")
    assert found is not None
    assert found.class_id == 0


def test_missing_metadata_file_raises(tmp_path):
    (tmp_path / "raw" / "medicinal_leaf_images").mkdir(parents=True)
    (tmp_path / "metadata").mkdir()
    settings = Settings(DATASET_ROOT=str(tmp_path))
    loader = DatasetLoader(settings)
    with pytest.raises(DatasetLoadError):
        loader.load_classes()


def test_dataset_summary_reports_counts(tmp_path):
    loader = _make_loader(tmp_path, _SAMPLE_CLASSES)
    summary = loader.dataset_summary()
    assert summary["total_classes"] == 3
    assert summary["verified_classes"] == 2
    assert summary["raw_dir_exists"] is True
