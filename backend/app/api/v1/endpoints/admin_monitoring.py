"""Admin System Monitoring endpoint (Sprint 6, wired up in Sprint 7) — backend
health, process uptime, DB/ChromaDB status, model-loaded flags, and resource
usage. Admin-only.
"""

from fastapi import APIRouter, Depends

from app.api.deps import AdminMonitoringServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import AdminSystemStatusResponse, ChromaCollectionInfo

router = APIRouter(
    prefix="/admin/monitoring",
    tags=["Admin: System Monitoring"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "/status",
    response_model=AdminSystemStatusResponse,
    summary="Get system status",
    description="Backend/database/ChromaDB health, process uptime, model-loaded "
    "flags, and CPU/memory/disk usage.",
)
async def get_system_status(
    current_user: CurrentUserDep, service: AdminMonitoringServiceDep
) -> AdminSystemStatusResponse:
    result = await service.get_system_status()
    collection_info = result.pop("chromadb_collection")
    return AdminSystemStatusResponse(
        **result, chromadb_collection=ChromaCollectionInfo(**collection_info)
    )
