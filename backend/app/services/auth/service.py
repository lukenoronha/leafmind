"""AuthService — encapsulates all authentication/authorization business logic.

Routers stay thin: they parse the request, call one AuthService method, and
shape the response. All DB access, token issuance, and password checks live
here so the same logic can later be reused (e.g. by an admin CLI or a
background job) without duplicating it in a router.
"""

import uuid
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import LeafMindError
from app.core.security import (
    PasswordPolicyError,
    TokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.role import Role, RoleName
from app.models.user import User
from app.schemas.auth import TokenResponse


def _as_aware_utc(value: datetime) -> datetime:
    """Normalize a datetime to UTC-aware.

    Some drivers (notably SQLite, used in tests) discard timezone info even for
    `DateTime(timezone=True)` columns; PostgreSQL does not. Comparing against
    `datetime.now(timezone.utc)` requires both sides to be aware, so naive
    values read back from the DB are assumed UTC and normalized here.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


class AuthError(LeafMindError):
    """Base class for authentication/authorization failures (maps to 401/403/409)."""


class InvalidCredentialsError(AuthError):
    def __init__(self) -> None:
        super().__init__("Invalid email or password.", status_code=401)


class InactiveUserError(AuthError):
    def __init__(self) -> None:
        super().__init__("This account has been deactivated.", status_code=403)


class EmailAlreadyRegisteredError(AuthError):
    def __init__(self) -> None:
        super().__init__("An account with this email already exists.", status_code=409)


class InvalidTokenError(AuthError):
    def __init__(self, detail: str = "Invalid or expired token.") -> None:
        super().__init__(detail, status_code=401)


class RoleNotConfiguredError(AuthError):
    def __init__(self, role_name: str) -> None:
        super().__init__(f"Role '{role_name}' is not configured.", status_code=500)


class AuthService:
    """Stateless service — takes a DB session per call via the constructor."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    async def register(self, *, email: str, password: str, full_name: str) -> User:
        email_normalized = email.strip().lower()

        existing = await self.db.execute(select(User).where(User.email == email_normalized))
        if existing.scalar_one_or_none() is not None:
            raise EmailAlreadyRegisteredError()

        role = await self._get_role_by_name(settings.DEFAULT_USER_ROLE)

        user = User(
            email=email_normalized,
            full_name=full_name,
            hashed_password=hash_password(password),
            role_id=role.id,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user, attribute_names=["role"])

        logger.info("User registered: {} (role={})", user.email, role.name)
        return user

    # ------------------------------------------------------------------
    # Login / logout / refresh
    # ------------------------------------------------------------------

    async def login(self, *, email: str, password: str) -> TokenResponse:
        result = await self.db.execute(
            select(User).where(User.email == email.strip().lower())
        )
        user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.hashed_password):
            logger.warning("Failed login attempt for email={}", email)
            raise InvalidCredentialsError()

        if not user.is_active:
            logger.warning("Login rejected for deactivated user={}", user.email)
            raise InactiveUserError()

        tokens = await self._issue_token_pair(user)
        logger.info("User logged in: {}", user.email)
        return tokens

    async def logout(self, *, raw_refresh_token: str) -> None:
        token_hash = hash_token(raw_refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()

        if stored is not None and not stored.is_revoked:
            stored.is_revoked = True
            stored.revoked_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.info("Refresh token revoked (logout) for user_id={}", stored.user_id)
        # Logout is idempotent: an already-revoked or unknown token still returns success
        # to the client, since the net effect the client cares about (no valid session) holds.

    async def refresh(self, *, raw_refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(raw_refresh_token, expected_type=TokenType.REFRESH)
        except TokenError as exc:
            raise InvalidTokenError(str(exc)) from exc

        token_hash = hash_token(raw_refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()

        if stored is None or stored.is_revoked:
            raise InvalidTokenError("Refresh token has been revoked or does not exist.")

        if _as_aware_utc(stored.expires_at) < datetime.now(timezone.utc):
            raise InvalidTokenError("Refresh token has expired.")

        user = await self.db.get(User, uuid.UUID(payload.sub))
        if user is None or not user.is_active:
            raise InvalidTokenError("User no longer exists or is inactive.")

        # Rotate: revoke the presented token and issue a brand-new pair. This limits
        # the blast radius of a stolen refresh token to a single use.
        stored.is_revoked = True
        stored.revoked_at = datetime.now(timezone.utc)

        tokens = await self._issue_token_pair(user)
        logger.info("Refresh token rotated for user={}", user.email)
        return tokens

    # ------------------------------------------------------------------
    # Password management
    # ------------------------------------------------------------------

    async def change_password(
        self, *, user: User, current_password: str, new_password: str
    ) -> None:
        if not verify_password(current_password, user.hashed_password):
            raise InvalidCredentialsError()

        validate_password_strength(new_password)

        user.hashed_password = hash_password(new_password)

        # Revoke all existing refresh tokens so a compromised session can't
        # survive a password change.
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.is_revoked.is_(False)
            )
        )
        now = datetime.now(timezone.utc)
        for token in result.scalars():
            token.is_revoked = True
            token.revoked_at = now

        await self.db.commit()
        logger.info("Password changed for user={}; all sessions revoked", user.email)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_role_by_name(self, role_name: str) -> Role:
        result = await self.db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if role is None:
            raise RoleNotConfiguredError(role_name)
        return role

    async def _issue_token_pair(self, user: User) -> TokenResponse:
        access_token, _ = create_access_token(user_id=user.id, role=user.role.name)
        refresh_token, _ = create_refresh_token(user_id=user.id, role=user.role.name)

        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=datetime.now(timezone.utc)
                + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
            )
        )
        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
