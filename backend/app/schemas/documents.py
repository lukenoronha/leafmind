"""Request/response schemas for the document (RAG source PDF) upload API (Sprint 4)."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    content_type: str
    size_bytes: int
    checksum_sha256: str
    status: str
    status_message: str | None
    page_count: int | None
    chunk_count: int
    created_at: datetime


class DocumentListItem(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    size_bytes: int
    status: str
    status_message: str | None
    page_count: int | None
    chunk_count: int
    created_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentListItem]
    total: int
    limit: int
    offset: int
