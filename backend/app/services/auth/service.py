"""AuthService — encapsulates all authentication/authorization business logic.

Routers stay thin: they parse the request, call one AuthService method, and
shape the response. All DB access, token issuance, and password checks live
here so the same logic can later be reused (e.g. by an admin CLI or a
background job) without duplicating it in a router.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import LeafMindError
from app.core.security import (
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
from app.images.storage import ImageStorage, ImageTooLargeError, UnsupportedImageTypeError
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import TokenResponse


def _as_aware_utc(value: datetime) -> datetime:
    """Normalize a datetime to UTC-aware.

    Some drivers (notably SQLite, used in tests) discard timezone info even for
    `DateTime(timezone=True)` columns; PostgreSQL does not. Comparing against
    `datetime.now(timezone.utc)` requires both sides to be aware, so naive
    values read back from the DB are assumed UTC and normalized here.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


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


class InvalidAvatarUploadError(AuthError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class UserNotFoundError(AuthError):
    def __init__(self) -> None:
        super().__init__("User not found.", status_code=404)


class AuthService:
    """Stateless service — takes a DB session per call via the constructor."""

    def __init__(self, db: AsyncSession, *, avatar_storage: ImageStorage | None = None):
        self.db = db
        self._avatar_storage = avatar_storage or ImageStorage(
            upload_dir_attr="AVATAR_UPLOAD_DIR",
            max_size_mb_attr="MAX_AVATAR_UPLOAD_SIZE_MB",
            allowed_content_types_attr="ALLOWED_AVATAR_CONTENT_TYPES",
        )

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
            stored.revoked_at = datetime.now(UTC)
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

        if _as_aware_utc(stored.expires_at) < datetime.now(UTC):
            raise InvalidTokenError("Refresh token has expired.")

        user = await self.db.get(User, uuid.UUID(payload.sub))
        if user is None or not user.is_active:
            raise InvalidTokenError("User no longer exists or is inactive.")

        # Rotate: revoke the presented token and issue a brand-new pair. This limits
        # the blast radius of a stolen refresh token to a single use.
        stored.is_revoked = True
        stored.revoked_at = datetime.now(UTC)

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

        # Re-fetched in this service's own session — see update_profile's
        # comment on why the caller-supplied `user` isn't mutated directly.
        db_user = await self._get_user_or_raise(user.id)
        db_user.hashed_password = hash_password(new_password)

        # Revoke all existing refresh tokens so a compromised session can't
        # survive a password change.
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == db_user.id, RefreshToken.is_revoked.is_(False)
            )
        )
        now = datetime.now(UTC)
        for token in result.scalars():
            token.is_revoked = True
            token.revoked_at = now

        await self.db.commit()
        logger.info("Password changed for user={}; all sessions revoked", db_user.email)

    async def request_password_reset(self, *, email: str) -> str | None:
        """Issue a password-reset token if the email matches an active account.

        Always returns normally regardless of whether the email exists —
        the caller-facing message ("if an account exists...") must not leak
        which emails are registered, so a lookup miss and a lookup hit look
        identical to the client. Callers (the router) should not expose the
        return value to the client for the same reason; it exists so this
        method is directly unit-testable and so a future real mail sender
        has something to send without re-deriving the token.

        No SMTP/email provider is configured anywhere in this project (see
        Settings — there's no EMAIL_* block at all), so the reset link is
        also logged at INFO level rather than emailed. This is the same
        limitation the frontend's own comments already document for this
        flow; wiring a real mail provider is a separate, infra-level change
        outside this service's scope.
        """
        email_normalized = email.strip().lower()
        result = await self.db.execute(select(User).where(User.email == email_normalized))
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            logger.info(
                "Password reset requested for unknown/inactive email={} — no token issued",
                email_normalized,
            )
            return None

        raw_token = secrets.token_urlsafe(32)
        self.db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(raw_token),
                expires_at=datetime.now(UTC)
                + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
            )
        )
        await self.db.commit()

        reset_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"
        logger.bind(user_id=str(user.id)).info(
            "Password reset link for {} (expires in {} min): {}",
            user.email,
            settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
            reset_link,
        )
        return raw_token

    async def reset_password(self, *, raw_token: str, new_password: str) -> None:
        validate_password_strength(new_password)

        token_hash = hash_token(raw_token)
        result = await self.db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()

        if stored is None or stored.is_used:
            raise InvalidTokenError("Reset link is invalid or has already been used.")

        if _as_aware_utc(stored.expires_at) < datetime.now(UTC):
            raise InvalidTokenError("Reset link has expired. Please request a new one.")

        db_user = await self._get_user_or_raise(stored.user_id)
        db_user.hashed_password = hash_password(new_password)

        stored.is_used = True
        stored.used_at = datetime.now(UTC)

        # Same rationale as change_password: a working reset link is
        # equivalent to proving account ownership, so every existing
        # session should be forced to re-authenticate.
        tokens_result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == db_user.id, RefreshToken.is_revoked.is_(False)
            )
        )
        now = datetime.now(UTC)
        for token in tokens_result.scalars():
            token.is_revoked = True
            token.revoked_at = now

        await self.db.commit()
        logger.info("Password reset completed for user={}; all sessions revoked", db_user.email)

    # ------------------------------------------------------------------
    # Profile management (Sprint 8: User Hub)
    # ------------------------------------------------------------------

    async def update_profile(self, *, user: User, full_name: str) -> User:
        # Re-fetched in this service's own session rather than mutating the
        # caller-supplied `user` directly — that instance may have been
        # loaded by `get_current_user` in a different session (e.g. the test
        # client's dependency overrides each construct their own session per
        # service), so writing through it directly can silently commit
        # against a detached/foreign session. Mirrors AdminUserService's
        # update_user, which re-fetches for the same reason.
        db_user = await self._get_user_or_raise(user.id)
        db_user.full_name = full_name.strip()
        await self.db.commit()
        await self.db.refresh(db_user, attribute_names=["role"])
        logger.info("Profile updated for user={}", db_user.email)
        return db_user

    async def upload_avatar(
        self, *, user: User, raw_bytes: bytes, original_filename: str, content_type: str
    ) -> User:
        try:
            self._avatar_storage.validate_upload(
                content_type=content_type, size_bytes=len(raw_bytes)
            )
            stored_path, _checksum = self._avatar_storage.save(
                raw_bytes=raw_bytes, original_filename=original_filename
            )
        except (UnsupportedImageTypeError, ImageTooLargeError) as exc:
            logger.warning("Avatar upload rejected for user={}: {}", user.email, exc)
            raise InvalidAvatarUploadError(str(exc)) from exc

        db_user = await self._get_user_or_raise(user.id)
        previous_path = db_user.avatar_path
        db_user.avatar_path = str(stored_path)
        await self.db.commit()
        await self.db.refresh(db_user, attribute_names=["role"])

        # Best-effort cleanup of the replaced file — a failure here shouldn't
        # fail the request, since the new avatar is already persisted and the
        # user-visible outcome (their avatar changed) already succeeded.
        if previous_path:
            try:
                self._avatar_storage.delete(previous_path)
            except OSError:
                logger.warning("Could not delete previous avatar at {}", previous_path)

        logger.info("Avatar updated for user={}", db_user.email)
        return db_user

    @staticmethod
    def build_avatar_url(*, request_base_url: str, avatar_path: str | None) -> str | None:
        """Derive the public URL for a stored avatar path, or None if unset.

        Built from the request's own base URL (rather than a fixed
        "public host" setting, which doesn't exist in Settings) so this
        stays correct across localhost, LAN, and ngrok-tunneled deployments
        alike — see the `*.ngrok-free.{app,dev}` CORS allowance in
        app/main.py for why a fixed host can't be assumed here.
        """
        if not avatar_path:
            return None
        filename = Path(avatar_path).name
        return f"{request_base_url.rstrip('/')}/static/avatars/{filename}"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_role_by_name(self, role_name: str) -> Role:
        result = await self.db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if role is None:
            raise RoleNotConfiguredError(role_name)
        return role

    async def _get_user_or_raise(self, user_id: uuid.UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    async def _issue_token_pair(self, user: User) -> TokenResponse:
        access_token, _ = create_access_token(user_id=user.id, role=user.role.name)
        refresh_token, _ = create_refresh_token(user_id=user.id, role=user.role.name)

        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=datetime.now(UTC)
                + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
            )
        )
        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
