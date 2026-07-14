"""Evaluation API (Sprint 7) — classification metrics (accuracy/precision/
recall/F1/confusion matrix against the dataset's own labels) and RAG metrics
(retrieval time, similarity, context relevance, citation coverage) aggregated
over real chat traffic. Gated to developer/admin roles, matching the
Developer observability API's access model — this is QA/research tooling,
not end-user- or admin-user-management functionality.
"""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, EvaluationServiceDep, require_role
from app.models.evaluation_run import EvaluationRun, EvaluationRunType
from app.models.role import RoleName
from app.schemas.evaluation import (
    ClassificationEvaluationRequest,
    ClassificationEvaluationResponse,
    EvaluationRunDetailResponse,
    EvaluationRunListResponse,
    EvaluationRunSummary,
    RAGEvaluationRequest,
    RAGEvaluationResponse,
)

router = APIRouter(
    prefix="/evaluation",
    tags=["Evaluation"],
    dependencies=[Depends(require_role(RoleName.DEVELOPER, RoleName.ADMIN))],
)


@router.post(
    "/classification",
    response_model=ClassificationEvaluationResponse,
    summary="Run classification evaluation",
    description="Samples labeled images from the dataset's own class folders, "
    "classifies each with the real Qwen2.5-VL pipeline (no prediction rows are "
    "persisted), and computes accuracy/precision/recall/F1/confusion matrix "
    "against the folder labels via scikit-learn. Persists the result as an "
    "`EvaluationRun`.",
)
async def run_classification_evaluation(
    payload: ClassificationEvaluationRequest,
    current_user: CurrentUserDep,
    service: EvaluationServiceDep,
) -> ClassificationEvaluationResponse:
    run = await service.run_classification_evaluation(
        actor=current_user,
        sample_size_per_class=payload.sample_size_per_class,
        classes=payload.classes,
    )
    return _to_classification_response(run)


@router.post(
    "/rag",
    response_model=RAGEvaluationResponse,
    summary="Run RAG evaluation",
    description="Aggregates retrieval time, similarity scores, context "
    "relevance, and citation coverage over already-persisted grounded chat "
    "turns (optionally restricted to turns since a given timestamp). Persists "
    "the result as an `EvaluationRun`.",
)
async def run_rag_evaluation(
    payload: RAGEvaluationRequest,
    current_user: CurrentUserDep,
    service: EvaluationServiceDep,
) -> RAGEvaluationResponse:
    run = await service.compute_rag_evaluation_metrics(actor=current_user, since=payload.since)
    return _to_rag_response(run)


@router.get(
    "/runs",
    response_model=EvaluationRunListResponse,
    summary="List past evaluation runs",
)
async def list_runs(
    current_user: CurrentUserDep,
    service: EvaluationServiceDep,
    run_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> EvaluationRunListResponse:
    parsed_type = EvaluationRunType(run_type) if run_type else None
    runs, total = await service.list_runs(
        run_type=parsed_type, limit=min(limit, 100), offset=max(offset, 0)
    )
    return EvaluationRunListResponse(
        items=[
            EvaluationRunSummary(
                run_id=r.id,
                run_type=r.run_type.value,
                sample_count=r.sample_count,
                duration_ms=r.duration_ms,
                created_at=r.created_at,
            )
            for r in runs
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/runs/{run_id}",
    response_model=EvaluationRunDetailResponse,
    summary="Get one evaluation run's full detail",
)
async def get_run(
    run_id: uuid.UUID, current_user: CurrentUserDep, service: EvaluationServiceDep
) -> EvaluationRunDetailResponse:
    run = await service.get_run(run_id=run_id)
    return EvaluationRunDetailResponse(
        run_id=run.id,
        run_type=run.run_type.value,
        metrics=run.metrics,
        per_class_report=run.per_class_report,
        class_labels=run.class_labels,
        sample_size_per_class=run.sample_size_per_class,
        sample_count=run.sample_count,
        duration_ms=run.duration_ms,
        created_at=run.created_at,
    )


def _to_classification_response(run: EvaluationRun) -> ClassificationEvaluationResponse:
    m = run.metrics
    return ClassificationEvaluationResponse(
        run_id=run.id,
        accuracy=m["accuracy"],
        precision_macro=m["precision_macro"],
        recall_macro=m["recall_macro"],
        f1_macro=m["f1_macro"],
        confusion_matrix=m["confusion_matrix"],
        class_labels=run.class_labels or [],
        sample_count=run.sample_count,
        errors_count=m["errors_count"],
        duration_ms=run.duration_ms,
        created_at=run.created_at,
    )


def _to_rag_response(run: EvaluationRun) -> RAGEvaluationResponse:
    m = run.metrics
    return RAGEvaluationResponse(
        run_id=run.id,
        avg_retrieval_ms=m["avg_retrieval_ms"],
        median_retrieval_ms=m["median_retrieval_ms"],
        p95_retrieval_ms=m["p95_retrieval_ms"],
        avg_similarity_score=m["avg_similarity_score"],
        avg_retrieved_chunks=m["avg_retrieved_chunks"],
        zero_hit_rate=m["zero_hit_rate"],
        context_relevance=m["context_relevance"],
        citation_coverage=m["citation_coverage"],
        sample_count=run.sample_count,
        duration_ms=run.duration_ms,
        created_at=run.created_at,
    )
