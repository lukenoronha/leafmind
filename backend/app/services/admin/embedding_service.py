"""AdminEmbeddingService — vector store statistics, collection info, rebuild, and clear.

Thin wrapper: read operations delegate to `ChromaVectorStore.get_collection_info()`/
`count()` (new, additive introspection methods — see `app/rag/vectorstore.py`);
"rebuild" delegates entirely to the existing `RAGService.reindex(document_id=None)`;
"clear" delegates to the new `ChromaVectorStore.clear_all()`. No retrieval or
ingestion logic is duplicated or modified here — this service only adds audit
logging and an admin-facing shape around already-existing (or minimally
extended) primitives.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.rag.vectorstore import VectorStore, get_vector_store
from app.services.admin.audit import record_activity
from app.services.rag.service import RAGService


class AdminEmbeddingService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        vector_store: VectorStore | None = None,
        rag_service: RAGService | None = None,
    ):
        self.db = db
        self._vector_store = vector_store or get_vector_store()
        self._rag_service = rag_service or RAGService(db, vector_store=self._vector_store)

    def get_statistics(self) -> dict:
        return self._vector_store.get_collection_info()

    async def rebuild_all(self, *, actor: User) -> dict:
        """Clears and re-ingests every document's embeddings (delegates to `RAGService.reindex`)."""
        documents = await self._rag_service.reindex(document_id=None)

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="embeddings.rebuild_all",
            details={"document_count": len(documents)},
        )
        await self.db.commit()

        return {
            "reindexed_documents": len(documents),
            "vector_count": self._vector_store.count(),
        }

    async def clear_all(self, *, actor: User) -> dict:
        """Wipes the entire vector collection without re-ingesting — a distinct,
        more destructive action than `rebuild_all` (leaves the knowledge base
        unsearchable until a subsequent reindex)."""
        self._vector_store.clear_all()

        await record_activity(self.db, actor_user_id=actor.id, action="embeddings.clear_all")
        await self.db.commit()

        return {"vector_count": self._vector_store.count()}
