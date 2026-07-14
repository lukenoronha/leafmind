"""Admin Activity Log endpoint (Sprint 6, wired up in Sprint 7) — paginated/
filtered audit trail of admin actions, plus CSV export. Admin-only.
"""

from fastapi import APIRouter, Depends, Response

from app.api.deps import AdminActivityLogServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import AdminActivityLogEntry, AdminActivityLogListResponse

router = APIRouter(
    prefix="/admin/activity-log",
    tags=["Admin: Activity Log"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "",
    response_model=AdminActivityLogListResponse,
    summary="List admin activity",
    description="Paginated, optionally filtered (by actor email, action) audit "
    "trail of every admin mutation across user/dataset/knowledge-base/embedding/"
    "settings management.",
)
async def list_activity(
    current_user: CurrentUserDep,
    service: AdminActivityLogServiceDep,
    actor_email: str | None = None,
    action: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AdminActivityLogListResponse:
    entries, total = await service.list_activity(
        actor_email=actor_email, action=action, limit=min(limit, 200), offset=max(offset, 0)
    )
    return AdminActivityLogListResponse(
        items=[
            AdminActivityLogEntry(
                id=entry.id,
                actor_email=actor.email,
                action=entry.action,
                target_type=entry.target_type,
                target_id=entry.target_id,
                details=entry.details,
                created_at=entry.created_at,
            )
            for entry, actor in entries
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/export",
    summary="Export admin activity as CSV",
    description="Returns the full (unpaginated, up to a hard internal cap) "
    "matching activity as a downloadable CSV file. No Pydantic response model "
    "is declared since the payload is CSV text, not JSON.",
    response_class=Response,
)
async def export_activity_csv(
    current_user: CurrentUserDep,
    service: AdminActivityLogServiceDep,
    actor_email: str | None = None,
    action: str | None = None,
) -> Response:
    csv_text = await service.export_csv(actor_email=actor_email, action=action)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_log.csv"},
    )
