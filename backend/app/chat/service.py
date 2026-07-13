"""ChatService — temporary VLM-only conversational feature (no RAG).

Sprint 4 will introduce a ChromaDB-backed retrieval step; this service is
deliberately isolated so that Sprint 4 can inject a retrieval step ahead of
`VLMInferencePipeline.chat()` (e.g. by prepending retrieved context to
`prediction_context` or the message list) without changing the persistence
logic, endpoint, or schemas here.
"""

import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import LeafMindError
from app.images.storage import ImageStorage
from app.images.preprocessing.steps import load_image_rgb, to_pil_image
from app.inference.vlm.pipeline import InferenceError, VLMInferencePipeline
from app.models.chat_message import ChatMessage, ChatRole
from app.models.prediction import Prediction
from app.models.uploaded_image import UploadedImage
from app.models.user import User


class ChatError(LeafMindError):
    """Base class for chat failures."""


class ChatImageNotFoundError(ChatError):
    def __init__(self) -> None:
        super().__init__("Referenced image not found.", status_code=404)


class ChatInferenceFailedError(ChatError):
    def __init__(self, message: str) -> None:
        super().__init__(f"Chat inference failed: {message}", status_code=502)


class ChatService:
    """Persists conversation turns and generates replies via the VLM directly."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        storage: ImageStorage | None = None,
        inference: VLMInferencePipeline | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._storage = storage or ImageStorage()
        self._inference = inference

    async def send_message(
        self,
        *,
        user: User,
        message: str,
        conversation_id: uuid.UUID | None,
        image_id: uuid.UUID | None,
    ) -> tuple[uuid.UUID, ChatMessage]:
        conversation_id = conversation_id or uuid.uuid4()

        history = await self._load_history(user=user, conversation_id=conversation_id)

        pil_image = None
        image: UploadedImage | None = None
        if image_id is not None:
            image = await self.db.get(UploadedImage, image_id)
            if image is None or image.user_id != user.id:
                raise ChatImageNotFoundError()
            raw_bytes = self._storage.read(image.stored_path)
            pil_image = to_pil_image(load_image_rgb(raw_bytes))

        prediction_context = await self._latest_prediction_context(image_id) if image_id else None

        user_message = ChatMessage(
            conversation_id=conversation_id,
            user_id=user.id,
            image_id=image_id,
            role=ChatRole.USER,
            content=message,
        )
        self.db.add(user_message)

        inference_pipeline = self._inference or VLMInferencePipeline(
            max_new_tokens=self._settings.CHAT_MAX_NEW_TOKENS
        )

        try:
            turn = inference_pipeline.chat(
                user_message=message,
                history=history,
                pil_image=pil_image,
                prediction_context=prediction_context,
                max_new_tokens=self._settings.CHAT_MAX_NEW_TOKENS,
            )
        except InferenceError as exc:
            logger.error("Chat inference failed for user={}: {}", user.email, exc)
            raise ChatInferenceFailedError(str(exc)) from exc

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
        )
        self.db.add(assistant_message)
        await self.db.commit()
        await self.db.refresh(assistant_message)

        logger.bind(
            user_id=str(user.id),
            conversation_id=str(conversation_id),
            inference_ms=round(turn.inference_ms, 2),
        ).info("Chat turn completed")

        return conversation_id, assistant_message

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

    async def _latest_prediction_context(self, image_id: uuid.UUID) -> str | None:
        result = await self.db.execute(
            select(Prediction)
            .where(Prediction.image_id == image_id)
            .order_by(Prediction.created_at.desc())
            .limit(1)
        )
        prediction = result.scalar_one_or_none()
        if prediction is None:
            return None
        return f"Predicted species '{prediction.predicted_label}' with confidence {prediction.confidence:.2f}."
