"""Admin Settings endpoints (Sprint 6) — view and manage a fixed allow-list of
admin-configurable parameters (RAG Top-K, similarity threshold, upload limits,
session timeout, default model version). Admin-only.

See `app.services.admin.settings_service` for the scope: these are DB-persisted
override records reviewed/edited here; the AI/RAG pipeline itself continues
reading only the static `.env`-loaded `Settings` singleton, unchanged.
"""

from fastapi import APIRouter, Depends

from app.api.deps import AdminSettingsServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import (
    AdminSettingListResponse,
    AdminSettingResponse,
    AdminUpdateSettingRequest,
)

router = APIRouter(
    prefix="/admin/settings",
    tags=["Admin: Settings"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "",
    response_model=AdminSettingListResponse,
    summary="List all admin-configurable settings",
    description="Returns the current effective value (DB override if present, "
    "else the static default) for every configurable parameter.",
)
async def list_settings(
    current_user: CurrentUserDep, service: AdminSettingsServiceDep
) -> AdminSettingListResponse:
    return AdminSettingListResponse(items=[AdminSettingResponse(**s) for s in await service.list_settings()])


@router.get(
    "/{key}",
    response_model=AdminSettingResponse,
    summary="Get one setting",
)
async def get_setting(
    key: str, current_user: CurrentUserDep, service: AdminSettingsServiceDep
) -> AdminSettingResponse:
    return AdminSettingResponse(**await service.get_setting(key=key))


@router.put(
    "/{key}",
    response_model=AdminSettingResponse,
    summary="Update a setting",
    description="Persists a new override value for this setting, audit-logged.",
)
async def update_setting(
    key: str,
    payload: AdminUpdateSettingRequest,
    current_user: CurrentUserDep,
    service: AdminSettingsServiceDep,
) -> AdminSettingResponse:
    return AdminSettingResponse(
        **await service.update_setting(actor=current_user, key=key, value=payload.value)
    )


@router.delete(
    "/{key}",
    response_model=AdminSettingResponse,
    summary="Reset a setting to its default",
    description="Removes the DB override for this setting, reverting to the static default.",
)
async def reset_setting(
    key: str, current_user: CurrentUserDep, service: AdminSettingsServiceDep
) -> AdminSettingResponse:
    return AdminSettingResponse(**await service.reset_setting(actor=current_user, key=key))
