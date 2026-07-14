"""AdminKnowledgeBaseService — admin-facing wrapper over `RAGService`'s document lifecycle.

Every method here delegates to the already-existing `RAGService` methods
(`upload_document`, `delete_document`, `list_documents`, `reindex`) — this
service adds nothing to the ingestion/retrieval pipeline itself, only audit
logging and one genuinely new read: per-document chunk detail (Sprint 4 only
exposed document-level metadata via `GET /documents`, not the underlying
chunks), which is a plain read over the existing `DocumentChunk` table.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.services.admin.audit import record_activity
from app.services.admin.exceptions import AdminError
from app.services.rag.service import RAGService


class DocumentNotFoundError(AdminError):
    def __init__(self) -> None:
        super().__init__("Document not found.", status_code=404)


class AdminKnowledgeBaseService:
    def __init__(self, db: AsyncSession, *, rag_service: RAGService | None = None):
        self.db = db
        self._rag_service = rag_service or RAGService(db)

    async def upload_document(
        self, *, actor: User, raw_bytes: bytes, original_filename: str, content_type: str
    ) -> Document:
        document = await self._rag_service.upload_document(
            user=actor,
            raw_bytes=raw_bytes,
            original_filename=original_filename,
            content_type=content_type,
        )

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="knowledge_base.upload_document",
            target_type="document",
            target_id=str(document.id),
            details={"original_filename": original_filename, "status": document.status.value},
        )
        await self.db.commit()
        return document

    async def list_documents(self, *, limit: int = 50, offset: int = 0) -> tuple[list[Document], int]:
        return await self._rag_service.list_documents(limit=limit, offset=offset)

    async def get_document_detail(self, *, document_id: uuid.UUID) -> tuple[Document, list[DocumentChunk]]:
        document = await self.db.get(Document, document_id)
        if document is None:
            raise DocumentNotFoundError()

        result = await self.db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index.asc())
        )
        return document, list(result.scalars().all())

    async def delete_document(self, *, actor: User, document_id: uuid.UUID) -> None:
        await self._rag_service.delete_document(document_id=document_id)

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="knowledge_base.delete_document",
            target_type="document",
            target_id=str(document_id),
        )
        await self.db.commit()

    async def reindex(self, *, actor: User, document_id: uuid.UUID | None = None) -> list[Document]:
        documents = await self._rag_service.reindex(document_id=document_id)

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="knowledge_base.reindex",
            target_type="document" if document_id else None,
            target_id=str(document_id) if document_id else None,
            details={"reindexed_count": len(documents)},
        )
        await self.db.commit()
        return documents

    async def get_status(self) -> dict:
        return await self._rag_service.get_status()
