"""ReportService — builds downloadable PDF/JSON reports from already-persisted
`Prediction`/`EvaluationRun` data.

Reports are always generated on-demand; nothing here creates new persisted
state (no "generated report" bookkeeping table — see the module docstring
rationale in the Sprint 7 plan). The "related knowledge" section of a
prediction report is populated by running a real retrieval query against the
already-ingested document corpus (via `app.rag.retriever.Retriever`, reused
rather than duplicated) — it is never fabricated. If nothing relevant is
indexed, the report explicitly says so rather than inventing medicinal
content, which would be actively harmful in this domain.
"""

import dataclasses
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import LeafMindError
from app.models.evaluation_run import EvaluationRun
from app.models.prediction import Prediction
from app.models.uploaded_image import UploadedImage
from app.models.user import User
from app.rag.retriever import Retriever
from app.services.evaluation.service import EvaluationRunNotFoundError
from app.services.reports import pdf_builder
from app.services.reports.schemas import CandidateReportRow, EvaluationReportData, PredictionReportData


class ReportError(LeafMindError):
    """Base class for report-generation failures."""


class PredictionNotFoundError(ReportError):
    def __init__(self) -> None:
        super().__init__("Prediction not found.", status_code=404)


class ReportService:
    """Builds and renders prediction/evaluation reports as PDF or JSON."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        retriever: Retriever | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._retriever = retriever or Retriever(settings=self._settings)

    async def build_prediction_report(
        self, *, prediction_id: uuid.UUID, user: User
    ) -> PredictionReportData:
        prediction = await self.db.get(Prediction, prediction_id)
        if prediction is None:
            raise PredictionNotFoundError()

        image = await self.db.get(UploadedImage, prediction.image_id)
        if image is None or image.user_id != user.id:
            raise PredictionNotFoundError()

        retrieval = self._retriever.retrieve(prediction.predicted_label, top_k=3)

        return PredictionReportData(
            prediction_id=prediction.id,
            image_id=image.id,
            original_filename=image.original_filename,
            predicted_label=prediction.predicted_label,
            confidence=prediction.confidence,
            candidates=[
                CandidateReportRow(
                    label=c.get("label", ""),
                    confidence=c.get("confidence", 0.0),
                    reasoning=c.get("reasoning", ""),
                )
                for c in prediction.candidates
            ],
            model_name=prediction.model_name,
            preprocessing_ms=prediction.preprocessing_ms,
            inference_ms=prediction.inference_ms,
            created_at=prediction.created_at,
            user_email=user.email,
            disclaimer=self._settings.REPORT_DISCLAIMER_TEXT,
            related_knowledge=retrieval.chunks,
            knowledge_available=len(retrieval.chunks) > 0,
        )

    async def build_evaluation_report(self, *, run_id: uuid.UUID) -> EvaluationReportData:
        run = await self.db.get(EvaluationRun, run_id)
        if run is None:
            raise EvaluationRunNotFoundError()

        return EvaluationReportData(
            run_id=run.id,
            run_type=run.run_type.value,
            metrics=run.metrics,
            per_class_report=run.per_class_report,
            class_labels=run.class_labels,
            sample_count=run.sample_count,
            duration_ms=run.duration_ms,
            created_at=run.created_at,
            disclaimer=self._settings.REPORT_DISCLAIMER_TEXT,
        )

    @staticmethod
    def render_json(data: PredictionReportData | EvaluationReportData) -> dict:
        return dataclasses.asdict(data)

    @staticmethod
    def render_prediction_pdf(data: PredictionReportData) -> bytes:
        return pdf_builder.build_prediction_pdf(data)

    @staticmethod
    def render_evaluation_pdf(data: EvaluationReportData) -> bytes:
        return pdf_builder.build_evaluation_pdf(data)
