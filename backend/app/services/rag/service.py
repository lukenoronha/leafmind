"""RAGService — grounded chat generation and document ingestion, replacing `ChatService`.

Owns everything `ChatService` used to own (conversation persistence, image/
prediction context, calling `VLMInferencePipeline.chat`) plus the new
retrieval step: `Retriever.retrieve()` runs ahead of generation and its
result is folded into the prompt via `app.rag.prompt_builder` instead of the
old `app.inference.vlm.prompts.build_chat_messages`. Also owns document
lifecycle (`upload_document`, `reindex`, `delete_document`, `list_documents`)
since both concerns share the same embedding/vector-store collaborators.
"""

import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import LeafMindError
from app.documents.storage import (
    DocumentStorage,
    DocumentTooLargeError,
    UnsupportedDocumentTypeError,
)
from app.images.preprocessing.steps import load_image_rgb, to_pil_image
from app.images.storage import ImageStorage
from app.inference.vlm.pipeline import InferenceError, VLMInferencePipeline
from app.models.chat_message import ChatMessage, ChatRole
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
from app.models.prediction import Prediction
from app.models.uploaded_image import UploadedImage
from app.models.user import User
from app.rag.pipeline import IngestionError, RAGIngestionPipeline
from app.rag.prompt_builder import build_rag_messages
from app.rag.retriever import Retriever
from app.rag.schemas import RetrievalResult
from app.rag.vectorstore import VectorStore, get_vector_store


class RAGError(LeafMindError):
    """Base class for RAG failures."""


class RAGImageNotFoundError(RAGError):
    def __init__(self) -> None:
        super().__init__("Referenced image not found.", status_code=404)


class RAGInferenceFailedError(RAGError):
    def __init__(self, message: str) -> None:
        super().__init__(f"RAG inference failed: {message}", status_code=502)


class RAGDocumentNotFoundError(RAGError):
    def __init__(self) -> None:
        super().__init__("Document not found.", status_code=404)


class RAGIngestionFailedError(RAGError):
    def __init__(self, message: str) -> None:
        super().__init__(f"Document ingestion failed: {message}", status_code=422)


class RAGInvalidUploadError(RAGError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class RAGService:
    """Grounded chat generation (retrieval + generation) and document lifecycle management."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        image_storage: ImageStorage | None = None,
        document_storage: DocumentStorage | None = None,
        inference: VLMInferencePipeline | None = None,
        retriever: Retriever | None = None,
        ingestion_pipeline: RAGIngestionPipeline | None = None,
        vector_store: VectorStore | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._image_storage = image_storage or ImageStorage()
        self._document_storage = document_storage or DocumentStorage()
        self._inference = inference
        self._retriever = retriever or Retriever(settings=self._settings)
        self._ingestion_pipeline = ingestion_pipeline or RAGIngestionPipeline(
            settings=self._settings
        )
        self._vector_store = vector_store or get_vector_store()

    # --- Grounded chat / query ---------------------------------------------------

    async def send_message(
        self,
        *,
        user: User,
        message: str,
        conversation_id: uuid.UUID | None,
        image_id: uuid.UUID | None,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        max_context_chars: int | None = None,
    ) -> tuple[uuid.UUID, ChatMessage, RetrievalResult]:
        """Persist a user turn, retrieve grounding context, and generate + persist a reply."""
        conversation_id = conversation_id or uuid.uuid4()

        history = await self._load_history(user=user, conversation_id=conversation_id)

        pil_image = None
        image: UploadedImage | None = None
        if image_id is not None:
            image = await self.db.get(UploadedImage, image_id)
            if image is None or image.user_id != user.id:
                raise RAGImageNotFoundError()
            raw_bytes = self._image_storage.read(image.stored_path)
            pil_image = to_pil_image(load_image_rgb(raw_bytes))

        predicted_plant = await self._latest_prediction_label(image_id) if image_id else None

        user_message = ChatMessage(
            conversation_id=conversation_id,
            user_id=user.id,
            image_id=image_id,
            role=ChatRole.USER,
            content=message,
        )
        self.db.add(user_message)

        retrieval = self._retriever.retrieve(
            message,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            max_context_chars=max_context_chars,
        )

        rag_messages = build_rag_messages(
            user_message=message,
            retrieved_chunks=retrieval.chunks,
            history=history,
            predicted_plant=predicted_plant,
            pil_image=pil_image,
        )

        inference_pipeline = self._inference or VLMInferencePipeline(
            max_new_tokens=self._settings.RAG_MAX_NEW_TOKENS
        )

        try:
            turn = inference_pipeline.generate_from_messages(
                rag_messages, max_new_tokens=self._settings.RAG_MAX_NEW_TOKENS
            )
        except InferenceError as exc:
            logger.error("RAG inference failed for user={}: {}", user.email, exc)
            raise RAGInferenceFailedError(str(exc)) from exc

        assistant_message = ChatMessage(
            conversation_id=conversation_id,
            user_id=user.id,
            image_id=image_id,
            role=ChatRole.ASSISTANT,
            content=turn.response_text,
            model_name=turn.model_name,
            inference_ms=turn.inference_ms,
            prompt_tokens=turn.prompt_tokens,
            completion_tokens=turn.completion_tokens,
            retrieval_ms=retrieval.retrieval_ms,
            retrieved_chunk_count=len(retrieval.chunks),
            retrieved_sources=[
                {
                    "chunk_id": c.chunk_id,
                    "document_id": c.document_id,
                    "document_name": c.document_name,
                    "page_number": c.page_number,
                    "chapter": c.chapter,
                    "score": c.score,
                }
                for c in retrieval.chunks
            ],
        )
        self.db.add(assistant_message)
        await self.db.commit()
        await self.db.refresh(assistant_message)

        logger.bind(
            user_id=str(user.id),
            conversation_id=str(conversation_id),
            inference_ms=round(turn.inference_ms, 2),
            retrieval_ms=round(retrieval.retrieval_ms, 2),
            retrieved_chunks=len(retrieval.chunks),
        ).info("RAG chat turn completed")

        return conversation_id, assistant_message, retrieval

    async def _load_history(
        self, *, user: User, conversation_id: uuid.UUID
    ) -> list[tuple[str, str]]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id, ChatMessage.user_id == user.id)
            .order_by(ChatMessage.created_at.asc())
            .limit(self._settings.CHAT_MAX_HISTORY_MESSAGES)
        )
        return [(msg.role.value, msg.content) for msg in result.scalars().all()]

    async def _latest_prediction_label(self, image_id: uuid.UUID) -> str | None:
        result = await self.db.execute(
            select(Prediction)
            .where(Prediction.image_id == image_id)
            .order_by(Prediction.created_at.desc())
            .limit(1)
        )
        prediction = result.scalar_one_or_none()
        if prediction is None:
            return None
        return f"{prediction.predicted_label} (confidence {prediction.confidence:.2f})"

    # --- Document lifecycle -------------------------------------------------------

    async def upload_document(
        self, *, user: User, raw_bytes: bytes, original_filename: str, content_type: str
    ) -> Document:
        try:
            self._document_storage.validate_upload(
                content_type=content_type, size_bytes=len(raw_bytes)
            )
            stored_path, checksum = self._document_storage.save(
                raw_bytes=raw_bytes, original_filename=original_filename
            )
        except (UnsupportedDocumentTypeError, DocumentTooLargeError) as exc:
            logger.warning("Document upload rejected for user={}: {}", user.email, exc)
            raise RAGInvalidUploadError(str(exc)) from exc

        document = Document(
            uploaded_by_id=user.id,
            original_filename=original_filename,
            stored_path=str(stored_path),
            content_type=content_type,
            size_bytes=len(raw_bytes),
            checksum_sha256=checksum,
            status=DocumentStatus.PENDING,
        )
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)

        await self._index_document(document)

        logger.bind(user_id=str(user.id), document_id=str(document.id)).info(
            "Document uploaded: {}", original_filename
        )
        return document

    async def _index_document(self, document: Document) -> None:
        """Parse, chunk, embed, and index a document; persists status + chunk rows."""
        document.status = DocumentStatus.INDEXING
        await self.db.commit()

        try:
            raw_bytes = self._document_storage.read(document.stored_path)
            chunks, chunk_ids, page_count = self._ingestion_pipeline.ingest(
                raw_bytes, document_id=document.id, document_name=document.original_filename
            )
        except IngestionError as exc:
            document.status = DocumentStatus.FAILED
            document.status_message = str(exc)
            await self.db.commit()
            logger.error("Ingestion failed for document_id={}: {}", document.id, exc)
            raise RAGIngestionFailedError(str(exc)) from exc

        for chunk_id, chunk in zip(chunk_ids, chunks, strict=False):
            self.db.add(
                DocumentChunk(
                    id=uuid.UUID(chunk_id),
                    document_id=document.id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.text,
                    page_number=chunk.page_number,
                    chapter=chunk.chapter,
                )
            )

        document.status = DocumentStatus.INDEXED
        document.status_message = None
        document.page_count = page_count
        document.chunk_count = len(chunks)
        await self.db.commit()
        await self.db.refresh(document)

    async def reindex(self, *, document_id: uuid.UUID | None = None) -> list[Document]:
        """Re-run ingestion for one document (or all documents if `document_id` is None).

        Existing chunk rows and vectors are cleared first so reindexing is
        idempotent (safe to re-run after a chunking/embedding config change).
        """
        query = select(Document)
        if document_id is not None:
            query = query.where(Document.id == document_id)
        result = await self.db.execute(query)
        documents = list(result.scalars().all())

        if document_id is not None and not documents:
            raise RAGDocumentNotFoundError()

        for document in documents:
            self._vector_store.delete_by_document(str(document.id))
            await self.db.execute(
                DocumentChunk.__table__.delete().where(DocumentChunk.document_id == document.id)
            )
            await self.db.commit()
            await self._index_document(document)

        return documents

    async def delete_document(self, *, document_id: uuid.UUID) -> None:
        document = await self.db.get(Document, document_id)
        if document is None:
            raise RAGDocumentNotFoundError()

        self._vector_store.delete_by_document(str(document.id))
        self._document_storage.delete(document.stored_path)

        await self.db.delete(document)
        await self.db.commit()

        logger.bind(document_id=str(document_id)).info("Document deleted")

    async def list_documents(
        self, *, limit: int = 50, offset: int = 0
    ) -> tuple[list[Document], int]:
        count_result = await self.db.execute(select(func.count(Document.id)))
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(Document).order_by(Document.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    async def get_status(self) -> dict:
        """Aggregate status for `GET /rag/status` — document counts and vector store health."""
        total_result = await self.db.execute(select(func.count(Document.id)))
        total_documents = total_result.scalar_one()

        indexed_result = await self.db.execute(
            select(func.count(Document.id)).where(Document.status == DocumentStatus.INDEXED)
        )
        indexed_documents = indexed_result.scalar_one()

        failed_result = await self.db.execute(
            select(func.count(Document.id)).where(Document.status == DocumentStatus.FAILED)
        )
        failed_documents = failed_result.scalar_one()

        chunk_count_result = await self.db.execute(select(func.count(DocumentChunk.id)))
        total_chunks = chunk_count_result.scalar_one()

        try:
            vector_count = self._vector_store.count()
            vector_store_ready = True
        except Exception as exc:  # vector store unreachable/uninitialized
            logger.warning("Vector store health check failed: {}", exc)
            vector_count = 0
            vector_store_ready = False

        return {
            "vector_store_ready": vector_store_ready,
            "total_documents": total_documents,
            "indexed_documents": indexed_documents,
            "failed_documents": failed_documents,
            "total_chunks": total_chunks,
            "vector_count": vector_count,
            "embedding_model": self._settings.RAG_EMBEDDING_MODEL_NAME,
            "collection_name": self._settings.CHROMADB_COLLECTION_NAME,
        }
