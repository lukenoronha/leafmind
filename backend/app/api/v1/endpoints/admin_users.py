"""Admin User Management endpoints (Sprint 6) — list, view, update, activate/deactivate,
reset password, and (soft-)delete users. Admin-only.
"""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import AdminUserServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import (
    AdminResetPasswordRequest,
    AdminSetActiveRequest,
    AdminUpdateUserRequest,
    AdminUserListResponse,
)
from app.schemas.auth import MessageResponse, UserResponse

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin: User Management"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "",
    response_model=AdminUserListResponse,
    summary="List users",
    description="Paginated, optionally filtered (by role, active status) list of all users.",
)
async def list_users(
    current_user: CurrentUserDep,
    service: AdminUserServiceDep,
    limit: int = 50,
    offset: int = 0,
    role: str | None = None,
    is_active: bool | None = None,
) -> AdminUserListResponse:
    users, total = await service.list_users(
        limit=min(limit, 200), offset=max(offset, 0), role=role, is_active=is_active
    )
    return AdminUserListResponse(
        items=[UserResponse.model_validate(u) for u in users], total=total, limit=limit, offset=offset
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user detail",
)
async def get_user(
    user_id: uuid.UUID, current_user: CurrentUserDep, service: AdminUserServiceDep
) -> UserResponse:
    user = await service.get_user(user_id=user_id)
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user",
    description="Update a user's full name and/or role. Admins cannot change their own role.",
)
async def update_user(
    user_id: uuid.UUID,
    payload: AdminUpdateUserRequest,
    current_user: CurrentUserDep,
    service: AdminUserServiceDep,
) -> UserResponse:
    user = await service.update_user(
        actor=current_user, user_id=user_id, full_name=payload.full_name, role_name=payload.role
    )
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}/active",
    response_model=UserResponse,
    summary="Activate or deactivate a user",
    description="Deactivating a user immediately revokes all their sessions and locks "
    "them out on next request/login. Admins cannot deactivate their own account.",
)
async def set_user_active(
    user_id: uuid.UUID,
    payload: AdminSetActiveRequest,
    current_user: CurrentUserDep,
    service: AdminUserServiceDep,
) -> UserResponse:
    user = await service.set_active(actor=current_user, user_id=user_id, is_active=payload.is_active)
    return UserResponse.model_validate(user)


@router.post(
    "/{user_id}/reset-password",
    response_model=UserResponse,
    summary="Admin-reset a user's password",
    description="Sets a new password and revokes all of the user's existing sessions.",
)
async def reset_password(
    user_id: uuid.UUID,
    payload: AdminResetPasswordRequest,
    current_user: CurrentUserDep,
    service: AdminUserServiceDep,
) -> UserResponse:
    user = await service.reset_password(
        actor=current_user, user_id=user_id, new_password=payload.new_password
    )
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Delete a user (soft-delete)",
    description="Deactivates the account rather than removing the row — every FK "
    "referencing this user (predictions, chat messages, uploaded documents) cascades "
    "on a hard delete, which would destroy that history. Use this to revoke access "
    "while preserving records.",
)
async def delete_user(
    user_id: uuid.UUID, current_user: CurrentUserDep, service: AdminUserServiceDep
) -> MessageResponse:
    await service.delete_user(actor=current_user, user_id=user_id)
    return MessageResponse(message="User deactivated.")


@router.delete(
    "/{user_id}/permanent",
    response_model=MessageResponse,
    summary="Permanently delete a user",
    description="Irreversibly deletes the user row and, via ON DELETE CASCADE, every "
    "refresh token, uploaded image, prediction, chat message, and document that "
    "references it. Distinct from the soft-delete above — use only when the account's "
    "history genuinely should not survive (spam/test accounts, erasure requests). "
    "Admins cannot permanently delete their own account.",
)
async def hard_delete_user(
    user_id: uuid.UUID, current_user: CurrentUserDep, service: AdminUserServiceDep
) -> MessageResponse:
    await service.hard_delete_user(actor=current_user, user_id=user_id)
    return MessageResponse(message="User permanently deleted.")
