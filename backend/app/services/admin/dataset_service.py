"""DatasetManagementService — admin upload/replace/delete/statistics over the
medicinal-leaf image dataset `DatasetLoader` reads.

Writes directly into the same on-disk tree `DatasetLoader` reads
(`raw/<folder_name>/*.jpg` + `metadata/classes.json`), and calls
`DatasetLoader.invalidate_cache()` after every mutation so the process-wide
cached taxonomy picks up the change on next read — without touching
`DatasetLoader`'s existing read methods or the inference pipeline that
consumes `get_verified_class_names()`.
"""

import json
import uuid
from pathlib import Path

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.datasets.loader import DatasetClass, DatasetLoader, DatasetLoadError, get_dataset_loader
from app.models.user import User
from app.services.admin.audit import record_activity
from app.services.admin.exceptions import DatasetClassNotFoundError, DatasetUploadError

_ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


class DatasetManagementService:
    """Admin CRUD over dataset classes (image folders + `classes.json` entries)."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        loader: DatasetLoader | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._loader = loader or get_dataset_loader()
        self._root = Path(self._settings.DATASET_ROOT)
        self._raw_dir = self._root / self._settings.DATASET_RAW_SUBDIR
        self._metadata_dir = self._root / self._settings.DATASET_METADATA_SUBDIR
        self._classes_path = self._metadata_dir / "classes.json"

    def get_statistics(self) -> dict:
        return self._loader.dataset_summary()

    def list_classes(self) -> list[DatasetClass]:
        return self._loader.load_classes()

    async def upload_class(
        self,
        *,
        actor: User,
        training_label: str,
        folder_name: str,
        images: list[tuple[str, bytes]],
        replace_existing: bool = False,
    ) -> DatasetClass:
        """Adds (or, if `replace_existing`, replaces) one class's images + taxonomy entry.

        `images` is a list of (original_filename, raw_bytes) pairs. Existing
        images in the target folder are left in place unless
        `replace_existing` is set, in which case the folder is cleared first
        (a "replace" operation, not an incremental "add").
        """
        if not images:
            raise DatasetUploadError("At least one image is required.")

        for filename, _ in images:
            if Path(filename).suffix.lower() not in _ALLOWED_IMAGE_SUFFIXES:
                raise DatasetUploadError(
                    f"Unsupported image type for '{filename}'. "
                    f"Allowed: {', '.join(sorted(_ALLOWED_IMAGE_SUFFIXES))}"
                )

        payload = self._read_classes_payload()
        existing_entries = payload.get("classes", [])
        existing = next((e for e in existing_entries if e["folder_name"] == folder_name), None)

        class_dir = self._raw_dir / folder_name
        class_dir.mkdir(parents=True, exist_ok=True)

        if replace_existing:
            for existing_file in class_dir.iterdir():
                if existing_file.is_file():
                    existing_file.unlink()

        for filename, raw_bytes in images:
            suffix = Path(filename).suffix.lower()
            (class_dir / f"{uuid.uuid4()}{suffix}").write_bytes(raw_bytes)

        if existing is not None:
            existing["training_label"] = training_label
            existing["status"] = "active"
            class_id = existing["class_id"]
        else:
            class_id = max((e["class_id"] for e in existing_entries), default=-1) + 1
            existing_entries.append(
                {
                    "class_id": class_id,
                    "training_label": training_label,
                    "folder_name": folder_name,
                    "status": "active",
                }
            )

        payload["classes"] = existing_entries
        self._write_classes_payload(payload)
        self._loader.invalidate_cache()

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="dataset.upload_class",
            target_type="dataset_class",
            target_id=folder_name,
            details={
                "training_label": training_label,
                "image_count": len(images),
                "replaced_existing": replace_existing,
            },
        )
        await self.db.commit()

        logger.info(
            "Admin {} {} dataset class '{}' ({} images)",
            actor.email,
            "replaced" if replace_existing else "added",
            folder_name,
            len(images),
        )

        dataset_class = self._loader.find_class_by_name(folder_name)
        assert dataset_class is not None
        return dataset_class

    async def delete_class(self, *, actor: User, class_id: int) -> None:
        payload = self._read_classes_payload()
        entries = payload.get("classes", [])
        target = next((e for e in entries if e["class_id"] == class_id), None)
        if target is None:
            raise DatasetClassNotFoundError()

        folder_name = target["folder_name"]
        class_dir = self._raw_dir / folder_name
        if class_dir.is_dir():
            for file in class_dir.iterdir():
                if file.is_file():
                    file.unlink()
            class_dir.rmdir()

        payload["classes"] = [e for e in entries if e["class_id"] != class_id]
        self._write_classes_payload(payload)
        self._loader.invalidate_cache()

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="dataset.delete_class",
            target_type="dataset_class",
            target_id=folder_name,
            details={"class_id": class_id},
        )
        await self.db.commit()

        logger.info("Admin {} deleted dataset class '{}' (id={})", actor.email, folder_name, class_id)

    def _read_classes_payload(self) -> dict:
        if not self._classes_path.exists():
            return {"classes": []}
        try:
            return json.loads(self._classes_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise DatasetLoadError(f"Malformed classes.json: {exc}") from exc

    def _write_classes_payload(self, payload: dict) -> None:
        self._metadata_dir.mkdir(parents=True, exist_ok=True)
        self._classes_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
