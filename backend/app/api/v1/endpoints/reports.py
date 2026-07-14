"""Reports API (Sprint 7) — downloadable PDF/JSON reports for a prediction or
an evaluation run. Prediction reports are ownership-checked (a user can only
report on their own predictions); evaluation reports are gated to developer/
admin roles, matching the Evaluation API's access model.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Response

from app.api.deps import CurrentUserDep, ReportServiceDep, require_role
from app.models.role import RoleName
from app.schemas.reports import (
    EvaluationReportResponse,
    PredictionReportResponse,
    RelatedKnowledgeChunk,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/prediction/{prediction_id}",
    response_model=None,
    summary="Get a prediction report (PDF or JSON)",
    description="Prediction details, confidence, model timing, and related "
    "knowledge-base information (grounded via retrieval against the "
    "predicted species — explicitly marked unavailable if nothing is "
    "indexed, never fabricated). Ownership-checked: only the uploading "
    "user may request this report. Returns `application/pdf` bytes when "
    "`format=pdf`, or a JSON body (schema: `PredictionReportResponse`) "
    "when `format=json` (default) — response_model is disabled at the "
    "route level because the return type is conditional on `format`.",
)
async def get_prediction_report(
    prediction_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: ReportServiceDep,
    format: Literal["pdf", "json"] = "json",
) -> Response | PredictionReportResponse:
    data = await service.build_prediction_report(prediction_id=prediction_id, user=current_user)

    if format == "pdf":
        pdf_bytes = service.render_prediction_pdf(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=prediction_{prediction_id}.pdf"
            },
        )

    return PredictionReportResponse(
        prediction_id=data.prediction_id,
        image_id=data.image_id,
        original_filename=data.original_filename,
        predicted_label=data.predicted_label,
        confidence=data.confidence,
        candidates=[
            {"label": c.label, "confidence": c.confidence, "reasoning": c.reasoning}
            for c in data.candidates
        ],
        model_name=data.model_name,
        preprocessing_ms=data.preprocessing_ms,
        inference_ms=data.inference_ms,
        created_at=data.created_at,
        user_email=data.user_email,
        disclaimer=data.disclaimer,
        knowledge_available=data.knowledge_available,
        related_knowledge=[
            RelatedKnowledgeChunk(
                document_name=c.document_name,
                page_number=c.page_number,
                chapter=c.chapter,
                score=c.score,
                text=c.text,
            )
            for c in data.related_knowledge
        ],
    )


@router.get(
    "/evaluation/{run_id}",
    response_model=None,
    summary="Get an evaluation run report (PDF or JSON)",
    description="Renders a persisted `EvaluationRun`'s metrics (classification "
    "or RAG) as a downloadable report. Gated to developer/admin roles. "
    "Returns `application/pdf` bytes when `format=pdf`, or a JSON body "
    "(schema: `EvaluationReportResponse`) when `format=json` (default).",
    dependencies=[Depends(require_role(RoleName.DEVELOPER, RoleName.ADMIN))],
)
async def get_evaluation_report(
    run_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: ReportServiceDep,
    format: Literal["pdf", "json"] = "json",
) -> Response | EvaluationReportResponse:
    data = await service.build_evaluation_report(run_id=run_id)

    if format == "pdf":
        pdf_bytes = service.render_evaluation_pdf(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=evaluation_{run_id}.pdf"},
        )

    return EvaluationReportResponse(
        run_id=data.run_id,
        run_type=data.run_type,
        metrics=data.metrics,
        per_class_report=data.per_class_report,
        class_labels=data.class_labels,
        sample_count=data.sample_count,
        duration_ms=data.duration_ms,
        created_at=data.created_at,
        disclaimer=data.disclaimer,
    )
