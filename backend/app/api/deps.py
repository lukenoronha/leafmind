"""Centralized dependency-injection scaffolding.

Provides typed `Depends`-ready accessors for cross-cutting services. Auth is
now fully implemented (Sprint 2); AI inference and RAG remain placeholder
seams for future sprints so routers can already declare the dependencies
they'll eventually need without a later refactor.
"""

import uuid
from typing import Annotated, AsyncIterator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat import ChatService
from app.core.config import Settings, get_settings
from app.core.security import TokenError, TokenType, decode_token
from app.db.session import get_db_session
from app.models.role import RoleName
from app.models.user import User
from app.services.auth import AuthService
from app.services.auth.service import AuthError, InactiveUserError, InvalidTokenError
from app.services.image_analysis import ImageAnalysisService

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]

_bearer_scheme = HTTPBearer(
    scheme_name="BearerAuth",
    description="JWT access token issued by POST /api/v1/auth/login or /auth/refresh.",
)


async def get_auth_service(db: DbSessionDep) -> AsyncIterator[AuthService]:
    yield AuthService(db)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(
    db: DbSessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
) -> User:
    """Resolve the authenticated user from the `Authorization: Bearer <access_token>` header.

    This is the sole entry point for authentication middleware-equivalent behavior
    in FastAPI's DI model: any route depending on it (directly or transitively via
    `require_role`) is implicitly protected.
    """
    try:
        payload = decode_token(credentials.credentials, expected_type=TokenType.ACCESS)
    except TokenError as exc:
        raise InvalidTokenError(str(exc)) from exc

    user = await db.get(User, uuid.UUID(payload.sub))
    if user is None:
        raise InvalidTokenError("User associated with this token no longer exists.")
    if not user.is_active:
        raise InactiveUserError()

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_role(*allowed_roles: RoleName):
    """Dependency factory enforcing Role-Based Access Control.

    Usage: `user: Annotated[User, Depends(require_role(RoleName.ADMIN))]`.
    Roles are compared by name so this stays decoupled from the Role table's
    primary key.
    """
    allowed_names = {role.value for role in allowed_roles}

    async def _check(current_user: CurrentUserDep) -> User:
        if current_user.role.name not in allowed_names:
            raise AuthError(
                f"This action requires one of the following roles: {sorted(allowed_names)}.",
                status_code=403,
            )
        return current_user

    return _check


# --- Image analysis (Sprint 3: preprocessing + Qwen2.5-VL inference) ---


async def get_image_analysis_service(db: DbSessionDep) -> AsyncIterator[ImageAnalysisService]:
    yield ImageAnalysisService(db)


ImageAnalysisServiceDep = Annotated[ImageAnalysisService, Depends(get_image_analysis_service)]


# --- Chat (Sprint 3: VLM-only, pre-RAG) ---


async def get_chat_service(db: DbSessionDep) -> AsyncIterator[ChatService]:
    yield ChatService(db)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


# --- Placeholder seam for future sprints ---


class RAGServicePlaceholder:
    """Seam for the future ChromaDB-backed retrieval-augmented generation service."""

    async def is_ready(self) -> bool:
        return False


async def get_rag_service() -> AsyncIterator[RAGServicePlaceholder]:
    yield RAGServicePlaceholder()


RAGServiceDep = Annotated[RAGServicePlaceholder, Depends(get_rag_service)]
