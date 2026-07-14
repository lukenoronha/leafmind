"""DeveloperService — read-only observability aggregation for the developer API layer.

This service never touches the AI inference or RAG pipeline's behavior — it
only reads already-persisted data (`Prediction`, `ChatMessage`,
`DocumentChunk` rows) and introspects already-running collaborators
(`check_database_connection()`, `ChromaVectorStore.count()`, `psutil`), then
aggregates/reshapes it for developer-facing endpoints. Mirrors the
`RAGService`/`ImageAnalysisService` construction pattern (single class per
DB session, injected collaborators default to real singletons).
"""

import time
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import LeafMindError
from app.db.session import check_database_connection
from app.models.chat_message import ChatMessage, ChatRole
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
from app.models.prediction import Prediction
from app.models.uploaded_image import UploadedImage
from app.rag.prompt_builder import build_context_block, build_rag_messages
from app.rag.schemas import RetrievedChunk
from app.rag.vectorstore import VectorStore, get_vector_store
from app.services.developer import system_metrics
from app.services.developer.log_reader import LogReader


class DeveloperError(LeafMindError):
    """Base class for developer-API failures."""


class ChatMessageNotFoundError(DeveloperError):
    def __init__(self) -> None:
        super().__init__("Chat message not found.", status_code=404)


class PredictionNotFoundError(DeveloperError):
    def __init__(self) -> None:
        super().__init__("Prediction not found.", status_code=404)


class DeveloperService:
    """Aggregates timing metrics, prediction/RAG metadata, system status, logs, and analytics."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        vector_store: VectorStore | None = None,
        log_reader: LogReader | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._vector_store = vector_store or get_vector_store()
        self._log_reader = log_reader or LogReader(self._settings)

    # --- Prediction metadata (plant name, scientific name, confidence, model version) ---

    async def get_prediction_metadata(self, *, prediction_id: uuid.UUID) -> dict:
        prediction = await self.db.get(Prediction, prediction_id)
        if prediction is None:
            raise PredictionNotFoundError()
        return self._prediction_to_metadata(prediction)

    async def list_prediction_metadata(
        self, *, limit: int = 50, offset: int = 0
    ) -> tuple[list[dict], int]:
        count_result = await self.db.execute(select(func.count(Prediction.id)))
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(Prediction).order_by(Prediction.created_at.desc()).limit(limit).offset(offset)
        )
        predictions = result.scalars().all()
        return [self._prediction_to_metadata(p) for p in predictions], total

    @staticmethod
    def _prediction_to_metadata(prediction: Prediction) -> dict:
        # `predicted_label` is the dataset's scientific-name label (see
        # DatasetLoader.get_verified_class_names()) — there is no separate
        # common-name field, so plant_name/scientific_name both map to it.
        # `model_version` maps onto `model_name` (the HF model identifier
        # string already tracked) — no distinct version concept is persisted.
        return {
            "prediction_id": prediction.id,
            "image_id": prediction.image_id,
            "plant_name": prediction.predicted_label,
            "scientific_name": prediction.predicted_label,
            "confidence": prediction.confidence,
            "model_version": prediction.model_name,
            "timestamp": prediction.created_at,
            "candidates": prediction.candidates,
        }

    # --- Timing metrics (preprocessing, inference, retrieval, generation, total) ---

    async def get_prediction_timing(self, *, prediction_id: uuid.UUID) -> dict:
        prediction = await self.db.get(Prediction, prediction_id)
        if prediction is None:
            raise PredictionNotFoundError()

        total_ms = prediction.preprocessing_ms + prediction.inference_ms
        return {
            "prediction_id": prediction.id,
            "preprocessing_ms": prediction.preprocessing_ms,
            "inference_ms": prediction.inference_ms,
            "retrieval_ms": None,
            "total_ms": total_ms,
        }

    async def get_chat_message_timing(self, *, chat_message_id: uuid.UUID) -> dict:
        message = await self.db.get(ChatMessage, chat_message_id)
        if message is None:
            raise ChatMessageNotFoundError()

        retrieval_ms = message.retrieval_ms or 0.0
        inference_ms = message.inference_ms or 0.0
        return {
            "chat_message_id": message.id,
            "retrieval_ms": message.retrieval_ms,
            "prompt_construction_ms": None,
            "response_generation_ms": message.inference_ms,
            "total_ms": retrieval_ms + inference_ms,
        }

    async def get_average_timings(self) -> dict:
        """Aggregate timing averages across all persisted predictions/chat turns."""
        prediction_result = await self.db.execute(
            select(
                func.avg(Prediction.preprocessing_ms),
                func.avg(Prediction.inference_ms),
                func.count(Prediction.id),
            )
        )
        avg_preprocessing_ms, avg_inference_ms, prediction_count = prediction_result.one()

        chat_result = await self.db.execute(
            select(
                func.avg(ChatMessage.retrieval_ms),
                func.avg(ChatMessage.inference_ms),
                func.count(ChatMessage.id),
            ).where(ChatMessage.role == ChatRole.ASSISTANT)
        )
        avg_retrieval_ms, avg_chat_inference_ms, chat_turn_count = chat_result.one()

        return {
            "prediction_count": prediction_count,
            "avg_preprocessing_ms": _round_or_none(avg_preprocessing_ms),
            "avg_prediction_inference_ms": _round_or_none(avg_inference_ms),
            "chat_turn_count": chat_turn_count,
            "avg_retrieval_ms": _round_or_none(avg_retrieval_ms),
            "avg_chat_inference_ms": _round_or_none(avg_chat_inference_ms),
        }

    # --- RAG metadata (retrieved documents, similarity scores, chunk ids, embedding model) ---

    async def get_rag_metadata(self, *, chat_message_id: uuid.UUID) -> dict:
        message = await self.db.get(ChatMessage, chat_message_id)
        if message is None:
            raise ChatMessageNotFoundError()

        return {
            "chat_message_id": message.id,
            "retrieval_ms": message.retrieval_ms,
            "retrieved_chunk_count": message.retrieved_chunk_count,
            "embedding_model": self._settings.RAG_EMBEDDING_MODEL_NAME,
            "retrieved_sources": message.retrieved_sources or [],
        }

    # --- Prompt Inspector (sanitized: question, predicted plant, context, template) ---

    async def inspect_prompt(self, *, chat_message_id: uuid.UUID) -> dict:
        """Reconstructs a sanitized view of the prompt that produced `chat_message_id`.

        Raw prompt text is not persisted (see `RAGService.send_message`), so
        this re-derives it from already-persisted data: the prior user turn
        (the question), the linked image's latest prediction (predicted
        plant), and `retrieved_sources` (context excerpts) — using the exact
        same `app.rag.prompt_builder.build_rag_messages()` the real pipeline
        uses, but without invoking the VLM. No model internals, system
        prompt secrets beyond what's already user-facing, or other users'
        data are exposed — only this conversation's own turn.
        """
        assistant_message = await self.db.get(ChatMessage, chat_message_id)
        if assistant_message is None or assistant_message.role != ChatRole.ASSISTANT:
            raise ChatMessageNotFoundError()

        user_message = await self._preceding_user_message(assistant_message)
        predicted_plant = await self._predicted_plant_for(assistant_message)
        retrieved_chunks = await self._retrieved_chunks_from_sources(
            assistant_message.retrieved_sources or []
        )

        question = user_message.content if user_message else ""
        rag_messages = build_rag_messages(
            user_message=question,
            retrieved_chunks=retrieved_chunks,
            history=[],
            predicted_plant=predicted_plant,
        )

        return {
            "chat_message_id": assistant_message.id,
            "conversation_id": assistant_message.conversation_id,
            "user_question": question,
            "predicted_plant": predicted_plant,
            "retrieved_context_excerpts": [
                {
                    "document_name": c.document_name,
                    "page_number": c.page_number,
                    "chapter": c.chapter,
                    "score": c.score,
                    "excerpt": c.text[:500],
                }
                for c in retrieved_chunks
            ],
            "prompt_template": build_context_block(retrieved_chunks)[:2000],
            "rendered_messages": _sanitize_messages(rag_messages),
            "generated_response": assistant_message.content,
        }

    async def _preceding_user_message(self, assistant_message: ChatMessage) -> ChatMessage | None:
        result = await self.db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.conversation_id == assistant_message.conversation_id,
                ChatMessage.role == ChatRole.USER,
                ChatMessage.created_at <= assistant_message.created_at,
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _predicted_plant_for(self, assistant_message: ChatMessage) -> str | None:
        if assistant_message.image_id is None:
            return None

        result = await self.db.execute(
            select(Prediction)
            .where(Prediction.image_id == assistant_message.image_id)
            .order_by(Prediction.created_at.desc())
            .limit(1)
        )
        prediction = result.scalar_one_or_none()
        if prediction is None:
            return None
        return f"{prediction.predicted_label} (confidence {prediction.confidence:.2f})"

    async def _retrieved_chunks_from_sources(self, sources: list[dict]) -> list[RetrievedChunk]:
        if not sources:
            return []

        chunk_ids = [s["chunk_id"] for s in sources if s.get("chunk_id")]
        chunk_text_by_id: dict[str, str] = {}
        if chunk_ids:
            valid_ids = [uuid.UUID(cid) for cid in chunk_ids if _is_uuid(cid)]
            if valid_ids:
                result = await self.db.execute(
                    select(DocumentChunk).where(DocumentChunk.id.in_(valid_ids))
                )
                chunk_text_by_id = {str(row.id): row.content for row in result.scalars().all()}

        return [
            RetrievedChunk(
                chunk_id=s.get("chunk_id", ""),
                text=chunk_text_by_id.get(s.get("chunk_id", ""), ""),
                score=s.get("score", 0.0),
                document_id=s.get("document_id", ""),
                document_name=s.get("document_name", ""),
                page_number=s.get("page_number"),
                chapter=s.get("chapter"),
            )
            for s in sources
        ]

    # --- System Status ---

    async def get_system_status(self) -> dict:
        db_healthy = await check_database_connection()

        try:
            vector_count = self._vector_store.count()
            chromadb_healthy = True
        except Exception:
            vector_count = 0
            chromadb_healthy = False

        gpu = system_metrics.get_gpu_status()
        models = system_metrics.get_model_availability()
        resources = system_metrics.get_resource_usage()

        return {
            "backend_healthy": True,
            "database_healthy": db_healthy,
            "chromadb_healthy": chromadb_healthy,
            "vector_count": vector_count,
            "vlm_model_importable": models.vlm_importable,
            "vlm_model_loaded": models.vlm_loaded,
            "embedding_model_importable": models.embedding_importable,
            "embedding_model_loaded": models.embedding_loaded,
            "gpu_available": gpu.available,
            "gpu_device_count": gpu.device_count,
            "gpu_device_names": gpu.device_names,
            "cpu_percent": resources.cpu_percent,
            "memory_total_mb": resources.memory_total_mb,
            "memory_used_mb": resources.memory_used_mb,
            "memory_percent": resources.memory_percent,
            "disk_total_gb": resources.disk_total_gb,
            "disk_used_gb": resources.disk_used_gb,
            "disk_percent": resources.disk_percent,
        }

    # --- Logs ---

    def get_logs(
        self,
        *,
        level: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        start = time.perf_counter()
        entries, total = self._log_reader.read(
            level=level, search=search, limit=limit, offset=offset
        )
        query_ms = (time.perf_counter() - start) * 1000

        return {
            "items": [
                {
                    "timestamp": e.timestamp,
                    "level": e.level,
                    "message": e.message,
                    "module": e.module,
                    "function": e.function,
                    "line": e.line,
                    "extra": e.extra,
                }
                for e in entries
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
            "query_ms": round(query_ms, 2),
        }

    # --- Analytics ---

    async def get_analytics(self) -> dict:
        """Aggregate statistics across predictions, chat turns, and the RAG knowledge base."""
        prediction_result = await self.db.execute(
            select(
                func.count(Prediction.id),
                func.avg(Prediction.confidence),
                func.avg(Prediction.inference_ms),
            )
        )
        prediction_count, avg_confidence, avg_inference_ms = prediction_result.one()

        chat_result = await self.db.execute(
            select(func.avg(ChatMessage.retrieval_ms)).where(ChatMessage.role == ChatRole.ASSISTANT)
        )
        avg_retrieval_ms = chat_result.scalar_one()

        document_result = await self.db.execute(
            select(func.count(Document.id)).where(Document.status == DocumentStatus.INDEXED)
        )
        indexed_documents = document_result.scalar_one()

        chunk_result = await self.db.execute(select(func.count(DocumentChunk.id)))
        total_chunks = chunk_result.scalar_one()

        upload_result = await self.db.execute(select(func.count(UploadedImage.id)))
        total_uploads = upload_result.scalar_one()

        try:
            vector_count = self._vector_store.count()
        except Exception:
            vector_count = 0

        return {
            "total_uploads": total_uploads,
            "prediction_count": prediction_count,
            "avg_confidence": _round_or_none(avg_confidence),
            "avg_inference_ms": _round_or_none(avg_inference_ms),
            "avg_retrieval_ms": _round_or_none(avg_retrieval_ms),
            "indexed_documents": indexed_documents,
            "total_chunks": total_chunks,
            "vector_count": vector_count,
        }


def _round_or_none(value: float | None, digits: int = 2) -> float | None:
    return round(value, digits) if value is not None else None


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def _sanitize_messages(messages: list[dict]) -> list[dict]:
    """Strips any non-text content (e.g. embedded PIL images) from a message
    list before returning it over the API — the Prompt Inspector must never
    leak raw image tensors/binary payloads, only the text prompt structure.
    """
    sanitized = []
    for message in messages:
        content = message["content"]
        if isinstance(content, list):
            text_parts = [part["text"] for part in content if part.get("type") == "text"]
            content = " ".join(text_parts)
        sanitized.append({"role": message["role"], "content": content})
    return sanitized
