"""AdminUserService — user management for administrators.

Separate from `AuthService`: `AuthService` owns self-service auth flows
(register/login/logout/refresh/change-password) for the acting user
themselves, while this service owns admin operations performed *on other
users* (list, detail, update, deactivate/activate, role change). Keeping
them apart avoids bloating `AuthService` with admin-only concerns and
mirrors the `ImageAnalysisService`/`RAGService` split — one service per
bounded concern, all constructed the same way.

Deletion is intentionally soft-delete only (`is_active = False`): every FK
referencing `users.id` (`refresh_tokens`, `uploaded_images`, `predictions`,
`chat_messages`, `documents`) is `ondelete=CASCADE`, so a hard delete would
destroy a user's entire prediction/chat/document history — undesirable for
a system whose purpose is persisted classification records. Deactivation
already fully locks a user out via the existing `InactiveUserError` checks
in `AuthService.login()` and `app.api.deps.get_current_user()` — no new
enforcement logic was needed for it to take effect.
"""

import uuid
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, validate_password_strength
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.user import User
from app.services.admin.audit import record_activity
from app.services.admin.exceptions import CannotModifySelfError, UserNotFoundError
from app.services.auth.service import RoleNotConfiguredError


class AdminUserService:
    """Admin-facing CRUD and lifecycle operations over `User`."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(
        self, *, limit: int = 50, offset: int = 0, role: str | None = None, is_active: bool | None = None
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count(User.id))

        if role is not None:
            query = query.join(Role).where(Role.name == role)
            count_query = count_query.join(Role).where(Role.name == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    async def get_user(self, *, user_id: uuid.UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    async def update_user(
        self,
        *,
        actor: User,
        user_id: uuid.UUID,
        full_name: str | None = None,
        role_name: str | None = None,
    ) -> User:
        user = await self.get_user(user_id=user_id)
        changes: dict = {}

        if full_name is not None and full_name != user.full_name:
            changes["full_name"] = {"old": user.full_name, "new": full_name}
            user.full_name = full_name

        if role_name is not None and role_name != user.role.name:
            if user.id == actor.id:
                raise CannotModifySelfError("Admins cannot change their own role.")
            role = await self._get_role_by_name(role_name)
            changes["role"] = {"old": user.role.name, "new": role.name}
            user.role_id = role.id

        if changes:
            await record_activity(
                self.db,
                actor_user_id=actor.id,
                action="user.update",
                target_type="user",
                target_id=str(user.id),
                details=changes,
            )

        await self.db.commit()
        await self.db.refresh(user, attribute_names=["role"])

        logger.info("Admin {} updated user {}: {}", actor.email, user.email, changes)
        return user

    async def set_active(self, *, actor: User, user_id: uuid.UUID, is_active: bool) -> User:
        user = await self.get_user(user_id=user_id)

        if user.id == actor.id and not is_active:
            raise CannotModifySelfError("Admins cannot deactivate their own account.")

        user.is_active = is_active

        if not is_active:
            await self._revoke_all_sessions(user)

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="user.activate" if is_active else "user.deactivate",
            target_type="user",
            target_id=str(user.id),
        )
        await self.db.commit()
        await self.db.refresh(user, attribute_names=["role"])

        logger.info(
            "Admin {} {} user {}",
            actor.email,
            "activated" if is_active else "deactivated",
            user.email,
        )
        return user

    async def delete_user(self, *, actor: User, user_id: uuid.UUID) -> User:
        """Soft-delete: deactivates the account and revokes all sessions.

        See module docstring for why this never hard-deletes the row.
        """
        return await self.set_active(actor=actor, user_id=user_id, is_active=False)

    async def reset_password(
        self, *, actor: User, user_id: uuid.UUID, new_password: str
    ) -> User:
        user = await self.get_user(user_id=user_id)
        validate_password_strength(new_password)
        user.hashed_password = hash_password(new_password)

        await self._revoke_all_sessions(user)

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="user.reset_password",
            target_type="user",
            target_id=str(user.id),
        )
        await self.db.commit()
        await self.db.refresh(user, attribute_names=["role"])

        logger.info("Admin {} reset password for user {}", actor.email, user.email)
        return user

    async def _revoke_all_sessions(self, user: User) -> None:
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.is_revoked.is_(False)
            )
        )
        now = datetime.now(UTC)
        for token in result.scalars():
            token.is_revoked = True
            token.revoked_at = now

    async def _get_role_by_name(self, role_name: str) -> Role:
        result = await self.db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if role is None:
            raise RoleNotConfiguredError(role_name)
        return role
