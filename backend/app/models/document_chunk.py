"""DocumentChunk model — a single indexed text chunk of a Document.

The chunk's vector embedding itself lives in ChromaDB (see `app.rag.vectorstore`),
keyed by this row's `id` as the Chroma document id. This table is the
relational source of truth for chunk text/metadata (used to reconstruct
retrieval results and to support `/documents` listing and deletion without
querying Chroma), while Chroma is purely a similarity-search index over the
same ids — deleting a `Document` cascades to its chunks here and the
corresponding vectors are removed from Chroma by `RAGService` in the same
operation.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document


class DocumentChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One chunk of extracted, cleaned text from a source `Document`."""

    __tablename__ = "document_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document: Mapped["Document"] = relationship(back_populates="chunks")

    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)

    # Metadata extracted during ingestion (see app.rag.ingestion) — chapter is
    # nullable since not every PDF has extractable section/heading structure.
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chapter: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<DocumentChunk id={self.id} document_id={self.document_id} index={self.chunk_index}>"
