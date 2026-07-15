"""ChatMessage model — persisted turns of the RAG-grounded chat feature."""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.prediction import Prediction
    from app.models.uploaded_image import UploadedImage
    from app.models.user import User


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single turn in a conversation, optionally anchored to an uploaded image.

    `conversation_id` groups turns into one conversation (a user may have many
    conversations, e.g. one per uploaded image). It is a plain UUID rather
    than its own table for this sprint — promoting it to a full Conversation
    model is a natural, additive extension once a future sprint needs
    conversation-level metadata.

    `retrieval_ms`/`retrieved_chunk_count`/`retrieved_sources` are additive and
    nullable so pre-Sprint-4 rows (and non-grounded turns, e.g. the user's own
    messages) remain valid without a backfill; they're only populated on
    assistant turns that went through `RAGService.retrieve()`.

    `prediction_id` (Sprint 8) is additive/nullable for the same reason —
    it's derived server-side from `image_id`'s most recent prediction at
    send-time (see `RAGService.send_message`), not supplied by the client,
    so rows persisted before this existed simply have it as NULL. It exists
    so a conversation can be grouped/reopened by prediction, matching how
    the frontend's Chat History page already keys conversations client-side
    (see `frontend/src/lib/chat-storage.ts`).
    """

    __tablename__ = "chat_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship()

    image_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("uploaded_images.id", ondelete="SET NULL"), nullable=True, index=True
    )
    image: Mapped["UploadedImage | None"] = relationship(back_populates="chat_messages")

    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    prediction: Mapped["Prediction | None"] = relationship()

    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole, native_enum=False, length=20), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)

    model_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    inference_ms: Mapped[float | None] = mapped_column(nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    retrieval_ms: Mapped[float | None] = mapped_column(nullable=True)
    retrieved_chunk_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retrieved_sources: Mapped[list | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<ChatMessage id={self.id} role={self.role.value} conversation_id={self.conversation_id}>"
