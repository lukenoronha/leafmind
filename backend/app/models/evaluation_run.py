"""EvaluationRun model — a persisted record of one evaluation invocation.

Two kinds of run share this table (`run_type` discriminates): classification
evaluation (VLM accuracy/precision/recall/F1/confusion-matrix against the
dataset's own folder labels) and RAG evaluation (retrieval time, similarity,
context relevance, citation coverage aggregated over persisted `ChatMessage`
rows). Both are read-heavy, infrequently-written, JSON-shaped results, so one
table with a `metrics` JSON column avoids two near-identical tables while
`/evaluation/runs` can list/filter either kind uniformly.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, Float, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class EvaluationRunType(str, enum.Enum):
    CLASSIFICATION = "classification"
    RAG = "rag"


class EvaluationRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One evaluation invocation and its resulting metrics."""

    __tablename__ = "evaluation_runs"

    run_type: Mapped[EvaluationRunType] = mapped_column(
        Enum(EvaluationRunType, native_enum=False, length=20), nullable=False, index=True
    )

    triggered_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    triggered_by: Mapped["User"] = relationship()

    sample_size_per_class: Mapped[int | None] = mapped_column(Integer, nullable=True)

    metrics: Mapped[dict] = mapped_column(JSON, nullable=False)
    per_class_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    class_labels: Mapped[list | None] = mapped_column(JSON, nullable=True)

    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<EvaluationRun id={self.id} run_type={self.run_type.value} sample_count={self.sample_count}>"
