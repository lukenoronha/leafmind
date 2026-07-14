"""Developer API layer — observability endpoints for the AI/RAG pipeline (Sprint 5).

Read-only: every endpoint here aggregates or reshapes data already produced
by `ImageAnalysisService`/`RAGService` (via `DeveloperService`); nothing in
this module touches inference or retrieval behavior. All routes require the
`developer` or `admin` role.
"""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, DeveloperServiceDep, require_role
from app.models.role import RoleName
from app.schemas.developer import (
    AnalyticsResponse,
    AverageTimingsResponse,
    ChatMessageTimingResponse,
    LogListResponse,
    PredictionMetadata,
    PredictionMetadataListResponse,
    PredictionTimingResponse,
    PromptInspectorResponse,
    RAGMetadataResponse,
    SystemStatusResponse,
)

router = APIRouter(
    prefix="/developer",
    tags=["Developer (observability)"],
    dependencies=[Depends(require_role(RoleName.DEVELOPER, RoleName.ADMIN))],
)


@router.get(
    "/predictions/{prediction_id}/metadata",
    response_model=PredictionMetadata,
    summary="Get prediction metadata",
    description="Plant name, scientific name, confidence, model version, and timestamp "
    "for one prediction.",
)
async def get_prediction_metadata(
    prediction_id: uuid.UUID, current_user: CurrentUserDep, service: DeveloperServiceDep
) -> PredictionMetadata:
    metadata = await service.get_prediction_metadata(prediction_id=prediction_id)
    return PredictionMetadata(**metadata)


@router.get(
    "/predictions",
    response_model=PredictionMetadataListResponse,
    summary="List prediction metadata",
    description="Paginated prediction metadata across all users, most recent first.",
)
async def list_prediction_metadata(
    current_user: CurrentUserDep,
    service: DeveloperServiceDep,
    limit: int = 50,
    offset: int = 0,
) -> PredictionMetadataListResponse:
    items, total = await service.list_prediction_metadata(
        limit=min(limit, 200), offset=max(offset, 0)
    )
    return PredictionMetadataListResponse(
        items=[PredictionMetadata(**item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/predictions/{prediction_id}/timing",
    response_model=PredictionTimingResponse,
    summary="Get prediction pipeline timing",
    description="Preprocessing/inference/total latency (ms) for one prediction.",
)
async def get_prediction_timing(
    prediction_id: uuid.UUID, current_user: CurrentUserDep, service: DeveloperServiceDep
) -> PredictionTimingResponse:
    timing = await service.get_prediction_timing(prediction_id=prediction_id)
    return PredictionTimingResponse(**timing)


@router.get(
    "/chat-messages/{chat_message_id}/timing",
    response_model=ChatMessageTimingResponse,
    summary="Get RAG chat turn timing",
    description="Retrieval/response-generation/total latency (ms) for one assistant chat turn.",
)
async def get_chat_message_timing(
    chat_message_id: uuid.UUID, current_user: CurrentUserDep, service: DeveloperServiceDep
) -> ChatMessageTimingResponse:
    return ChatMessageTimingResponse(
        **await service.get_chat_message_timing(chat_message_id=chat_message_id)
    )


@router.get(
    "/metrics/timings",
    response_model=AverageTimingsResponse,
    summary="Get average pipeline timings",
    description="Average preprocessing/inference/retrieval latency across all "
    "persisted predictions and chat turns.",
)
async def get_average_timings(
    current_user: CurrentUserDep, service: DeveloperServiceDep
) -> AverageTimingsResponse:
    return AverageTimingsResponse(**await service.get_average_timings())


@router.get(
    "/chat-messages/{chat_message_id}/rag-metadata",
    response_model=RAGMetadataResponse,
    summary="Get RAG retrieval metadata for a chat turn",
    description="Retrieved documents, chunk ids, similarity scores, document metadata, "
    "retrieval time, and embedding model used for one assistant chat turn.",
)
async def get_rag_metadata(
    chat_message_id: uuid.UUID, current_user: CurrentUserDep, service: DeveloperServiceDep
) -> RAGMetadataResponse:
    return RAGMetadataResponse(**await service.get_rag_metadata(chat_message_id=chat_message_id))


@router.get(
    "/chat-messages/{chat_message_id}/prompt-inspector",
    response_model=PromptInspectorResponse,
    summary="Inspect the sanitized prompt behind a chat turn",
    description="Reconstructs (without re-invoking the model) the user question, predicted "
    "plant, retrieved context excerpts, prompt template, and generated response for one "
    "assistant chat turn. Image/binary payloads are stripped; only text content is exposed.",
)
async def inspect_prompt(
    chat_message_id: uuid.UUID, current_user: CurrentUserDep, service: DeveloperServiceDep
) -> PromptInspectorResponse:
    return PromptInspectorResponse(**await service.inspect_prompt(chat_message_id=chat_message_id))


@router.get(
    "/system-status",
    response_model=SystemStatusResponse,
    summary="Get full system status",
    description="Backend/database/ChromaDB health, VLM/embedding model availability, "
    "GPU status, and CPU/memory/disk usage.",
)
async def get_system_status(
    current_user: CurrentUserDep, service: DeveloperServiceDep
) -> SystemStatusResponse:
    return SystemStatusResponse(**await service.get_system_status())


@router.get(
    "/logs",
    response_model=LogListResponse,
    summary="Query application logs",
    description="Paginated, filterable structured log entries (by level and/or free-text search).",
)
async def get_logs(
    current_user: CurrentUserDep,
    service: DeveloperServiceDep,
    level: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> LogListResponse:
    return LogListResponse(
        **service.get_logs(level=level, search=search, limit=min(limit, 500), offset=max(offset, 0))
    )


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Get aggregate analytics",
    description="Prediction count, average confidence/inference/retrieval time, "
    "indexed document count, and vector count.",
)
async def get_analytics(
    current_user: CurrentUserDep, service: DeveloperServiceDep
) -> AnalyticsResponse:
    return AnalyticsResponse(**await service.get_analytics())
