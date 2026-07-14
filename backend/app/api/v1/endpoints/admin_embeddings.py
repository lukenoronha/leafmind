"""Admin Embedding Management endpoints (Sprint 6) — vector statistics, collection
info, rebuild-all, and clear-all. Admin-only.
"""

from fastapi import APIRouter, Depends

from app.api.deps import AdminEmbeddingServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import (
    EmbeddingClearResponse,
    EmbeddingRebuildResponse,
    EmbeddingStatisticsResponse,
)

router = APIRouter(
    prefix="/admin/embeddings",
    tags=["Admin: Embedding Management"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "/statistics",
    response_model=EmbeddingStatisticsResponse,
    summary="Get vector store statistics",
    description="ChromaDB collection name, vector count, persistence directory, and distance metric.",
)
async def get_statistics(
    current_user: CurrentUserDep, service: AdminEmbeddingServiceDep
) -> EmbeddingStatisticsResponse:
    return EmbeddingStatisticsResponse(**service.get_statistics())


@router.post(
    "/rebuild",
    response_model=EmbeddingRebuildResponse,
    summary="Rebuild all embeddings",
    description="Clears and re-ingests every document's chunks/vectors. Equivalent "
    "to knowledge base reindex with no `document_id`, exposed here for discoverability "
    "under Embedding Management.",
)
async def rebuild_all(
    current_user: CurrentUserDep, service: AdminEmbeddingServiceDep
) -> EmbeddingRebuildResponse:
    return EmbeddingRebuildResponse(**await service.rebuild_all(actor=current_user))


@router.post(
    "/clear",
    response_model=EmbeddingClearResponse,
    summary="Clear all embeddings",
    description="Wipes the entire vector collection WITHOUT re-ingesting — the "
    "knowledge base becomes unsearchable until a subsequent rebuild. Distinct from "
    "and more destructive than `/rebuild`.",
)
async def clear_all(
    current_user: CurrentUserDep, service: AdminEmbeddingServiceDep
) -> EmbeddingClearResponse:
    return EmbeddingClearResponse(**await service.clear_all(actor=current_user))
