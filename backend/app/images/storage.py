"""File-system storage for uploaded images.

Kept independent of the DB layer: this module only knows how to persist and
retrieve raw bytes on disk under a content-addressed filename. The DB layer
(`app.models.uploaded_image`) stores the resulting path plus metadata.
Swapping this for object storage (S3/GCS) later only requires changing this
module — nothing above it needs to know the storage backend.
"""

import hashlib
import uuid
from pathlib import Path

from app.core.config import Settings, get_settings


class UnsupportedImageTypeError(ValueError):
    """Raised when an upload's content type isn't in the configured allow-list."""


class ImageTooLargeError(ValueError):
    """Raised when an upload exceeds the configured maximum size."""


class ImageStorage:
    """Persists uploaded image bytes to a configurable directory on disk.

    Defaults to the leaf-photo upload settings (`UPLOAD_DIR`/
    `MAX_UPLOAD_SIZE_MB`/`ALLOWED_UPLOAD_CONTENT_TYPES`) so every existing
    caller is unaffected. Pass the `upload_dir_attr`/`max_size_mb_attr`/
    `allowed_content_types_attr` overrides to point the same validate/save/
    read/delete logic at a different on-disk directory and limits — e.g.
    avatars, which are smaller and served back over HTTP (see
    `AVATAR_UPLOAD_DIR` and the `/static/avatars` mount in app/main.py)
    instead of only ever being read back internally like leaf photos.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        upload_dir_attr: str = "UPLOAD_DIR",
        max_size_mb_attr: str = "MAX_UPLOAD_SIZE_MB",
        allowed_content_types_attr: str = "ALLOWED_UPLOAD_CONTENT_TYPES",
    ):
        self._settings = settings or get_settings()
        self._max_size_mb: int = getattr(self._settings, max_size_mb_attr)
        self._allowed_content_types: list[str] = getattr(
            self._settings, allowed_content_types_attr
        )
        self._root = Path(getattr(self._settings, upload_dir_attr))
        self._root.mkdir(parents=True, exist_ok=True)

    def validate_upload(self, *, content_type: str, size_bytes: int) -> None:
        if content_type not in self._allowed_content_types:
            raise UnsupportedImageTypeError(
                f"Unsupported content type '{content_type}'. "
                f"Allowed: {', '.join(self._allowed_content_types)}"
            )
        max_bytes = self._max_size_mb * 1024 * 1024
        if size_bytes > max_bytes:
            raise ImageTooLargeError(
                f"Image is {size_bytes / (1024 * 1024):.2f}MB; "
                f"maximum allowed is {self._max_size_mb}MB."
            )

    def save(self, *, raw_bytes: bytes, original_filename: str) -> tuple[Path, str]:
        """Persist raw bytes under a UUID-based filename. Returns (path, sha256_hex)."""
        checksum = hashlib.sha256(raw_bytes).hexdigest()
        suffix = Path(original_filename).suffix.lower() or ".jpg"
        stored_name = f"{uuid.uuid4()}{suffix}"
        stored_path = self._root / stored_name

        stored_path.write_bytes(raw_bytes)
        return stored_path, checksum

    def read(self, stored_path: str) -> bytes:
        return Path(stored_path).read_bytes()

    def delete(self, stored_path: str) -> None:
        path = Path(stored_path)
        if path.exists():
            path.unlink()
