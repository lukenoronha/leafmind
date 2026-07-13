"""Password hashing and JWT encode/decode primitives.

Kept dependency-free of the ORM/service layer so it can be unit tested in
isolation and reused by any future service (e.g. an admin CLI, a background
worker) without pulling in FastAPI request/response types.
"""

import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password with bcrypt (via passlib)."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time comparison of a plaintext password against its bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


class PasswordPolicyError(ValueError):
    """Raised when a candidate password fails the configured complexity policy."""


def validate_password_strength(password: str) -> None:
    """Enforce the configured password complexity policy.

    Raises `PasswordPolicyError` with a human-readable reason on failure.
    Centralizing this here means the rule set is defined once and applied
    identically at registration and at password-change time.
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long."
        )
    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        raise PasswordPolicyError("Password must contain at least one uppercase letter.")
    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        raise PasswordPolicyError("Password must contain at least one lowercase letter.")
    if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        raise PasswordPolicyError("Password must contain at least one digit.")
    if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r"[^\w\s]", password):
        raise PasswordPolicyError("Password must contain at least one special character.")


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenPayload(BaseModel):
    """Decoded, validated claims of a LeafMind-issued JWT."""

    sub: str
    role: str
    type: TokenType
    jti: str
    iat: datetime
    exp: datetime
    iss: str


class TokenError(Exception):
    """Raised for any invalid, expired, or malformed JWT."""


def _secret_for(token_type: TokenType) -> str:
    return (
        settings.JWT_SECRET_KEY
        if token_type is TokenType.ACCESS
        else settings.JWT_REFRESH_SECRET_KEY
    )


def create_access_token(*, user_id: uuid.UUID, role: str) -> tuple[str, str]:
    """Issue a short-lived access token. Returns (encoded_jwt, jti)."""
    return _create_token(
        user_id=user_id,
        role=role,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(*, user_id: uuid.UUID, role: str) -> tuple[str, str]:
    """Issue a long-lived refresh token. Returns (encoded_jwt, jti)."""
    return _create_token(
        user_id=user_id,
        role=role,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )


def _create_token(
    *, user_id: uuid.UUID, role: str, token_type: TokenType, expires_delta: timedelta
) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())
    claims: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": token_type.value,
        "jti": jti,
        "iat": now,
        "exp": now + expires_delta,
        "iss": settings.JWT_ISSUER,
    }
    encoded = jwt.encode(claims, _secret_for(token_type), algorithm=settings.JWT_ALGORITHM)
    return encoded, jti


def decode_token(token: str, *, expected_type: TokenType) -> TokenPayload:
    """Decode and validate a JWT, enforcing type/issuer/expiry.

    Raises `TokenError` for any failure — callers should not need to
    distinguish expired vs. malformed vs. wrong-type at the call site.
    """
    try:
        raw = jwt.decode(
            token,
            _secret_for(expected_type),
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "jti", "type"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(f"Invalid token: {exc}") from exc

    if raw.get("type") != expected_type.value:
        raise TokenError(f"Expected a {expected_type.value} token.")

    try:
        return TokenPayload.model_validate(raw)
    except Exception as exc:  # pydantic ValidationError
        raise TokenError(f"Malformed token payload: {exc}") from exc


def hash_token(raw_token: str) -> str:
    """SHA-256 digest of a raw refresh token, for opaque server-side storage/lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
