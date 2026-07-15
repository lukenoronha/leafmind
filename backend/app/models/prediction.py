"""Prediction model — the structured result of a single classification inference call."""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.uploaded_image import UploadedImage
    from app.models.user import User


class PredictionStatus(str, enum.Enum):
    """Outcome of the confidence-validation gate applied after classification.

    `CONFIDENT` predictions cleared `Settings.CONFIDENCE_THRESHOLD`;
    `LOW_CONFIDENCE` predictions did not (including the model's own
    "Unknown" fallback label) and should not be presented as a confident
    species identification, though the attempt is still saved to history.
    """

    CONFIDENT = "confident"
    LOW_CONFIDENCE = "low_confidence"


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

    status: Mapped[PredictionStatus] = mapped_column(
        # values_callable makes SQLAlchemy store/read the enum's *value*
        # ("confident"/"low_confidence" — what's actually in the DB and what
        # the API contract uses) instead of its default of the member *name*
        # ("CONFIDENT"/"LOW_CONFIDENCE"), which would reject every existing
        # row written by the migration's lowercase server_default.
        Enum(
            PredictionStatus,
            native_enum=False,
            length=20,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=PredictionStatus.CONFIDENT,
        server_default="confident",
    )

    is_saved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )

    model_name: Mapped[str] = mapped_column(String(150), nullable=False)
    raw_response: Mapped[str] = mapped_column(String, nullable=False)

    preprocessing_ms: Mapped[float] = mapped_column(Float, nullable=False)
    inference_ms: Mapped[float] = mapped_column(Float, nullable=False)

    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return (
            f"<Prediction id={self.id} label={self.predicted_label!r} "
            f"confidence={self.confidence} status={self.status.value}>"
        )
