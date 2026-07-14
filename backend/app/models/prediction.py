"""Prediction model — the structured result of a single classification inference call."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.uploaded_image import UploadedImage
    from app.models.user import User


class Prediction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One species-identification result for one uploaded image.

    `candidates` stores the full ranked list (as JSON) so `/history` and any
    future analytics can inspect runner-up candidates, not just the top
    prediction — without needing a separate child table for a fixed, small
    (top_k <= ~5) list.
    """

    __tablename__ = "predictions"

    image_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("uploaded_images.id", ondelete="CASCADE"), nullable=False, index=True
    )
    image: Mapped["UploadedImage"] = relationship(back_populates="predictions")

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship()

    predicted_label: Mapped[str] = mapped_column(String(150), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    candidates: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    model_name: Mapped[str] = mapped_column(String(150), nullable=False)
    raw_response: Mapped[str] = mapped_column(String, nullable=False)

    preprocessing_ms: Mapped[float] = mapped_column(Float, nullable=False)
    inference_ms: Mapped[float] = mapped_column(Float, nullable=False)

    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Prediction id={self.id} label={self.predicted_label!r} confidence={self.confidence}>"
