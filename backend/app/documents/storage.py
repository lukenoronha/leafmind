"""File-system storage for uploaded RAG source documents (PDFs).

Mirrors `app.images.storage.ImageStorage` exactly: content-addressed
filenames on disk, DB layer (`app.models.document.Document`) stores the
resulting path plus metadata. Swapping for object storage later only
requires changing this module.
"""

import hashlib
import uuid
from pathlib import Path

from app.core.config import Settings, get_settings


class UnsupportedDocumentTypeError(ValueError):
    """Raised when an upload's content type isn't in the configured allow-list."""


class DocumentTooLargeError(ValueError):
    """Raised when an upload exceeds the configured maximum size."""


class DocumentStorage:
    """Persists uploaded document bytes to a configurable directory on disk."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()
        self._root = Path(self._settings.DOCUMENT_UPLOAD_DIR)
        self._root.mkdir(parents=True, exist_ok=True)

    def validate_upload(self, *, content_type: str, size_bytes: int) -> None:
        if content_type not in self._settings.ALLOWED_DOCUMENT_CONTENT_TYPES:
            raise UnsupportedDocumentTypeError(
                f"Unsupported content type '{content_type}'. "
                f"Allowed: {', '.join(self._settings.ALLOWED_DOCUMENT_CONTENT_TYPES)}"
            )
        max_bytes = self._settings.MAX_DOCUMENT_UPLOAD_SIZE_MB * 1024 * 1024
        if size_bytes > max_bytes:
            raise DocumentTooLargeError(
                f"Document is {size_bytes / (1024 * 1024):.2f}MB; "
                f"maximum allowed is {self._settings.MAX_DOCUMENT_UPLOAD_SIZE_MB}MB."
            )

    def save(self, *, raw_bytes: bytes, original_filename: str) -> tuple[Path, str]:
        """Persist raw bytes under a UUID-based filename. Returns (path, sha256_hex)."""
        checksum = hashlib.sha256(raw_bytes).hexdigest()
        suffix = Path(original_filename).suffix.lower() or ".pdf"
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
