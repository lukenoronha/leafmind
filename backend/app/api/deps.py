"""Centralized dependency-injection scaffolding.

Provides typed `Depends`-ready accessors for cross-cutting services. Auth,
image analysis, and RAG are fully implemented; each router depends only on
the typed `...Dep` alias for its service, never constructing services itself.
"""

import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import TokenError, TokenType, decode_token
from app.db.session import get_db_session
from app.models.role import RoleName
from app.models.user import User
from app.services.admin import (
    AdminActivityLogService,
    AdminEmbeddingService,
    AdminKnowledgeBaseService,
    AdminMonitoringService,
    AdminSettingsService,
    AdminUserService,
    DatasetManagementService,
)
from app.services.auth import AuthService
from app.services.auth.service import AuthError, InactiveUserError, InvalidTokenError
from app.services.developer import DeveloperService
from app.services.evaluation import EvaluationService
from app.services.image_analysis import ImageAnalysisService
from app.services.rag import RAGService
from app.services.reports import ReportService

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


# --- RAG (Sprint 4: grounded chat + document ingestion, replaces Sprint 3 ChatService) ---


async def get_rag_service(db: DbSessionDep) -> AsyncIterator[RAGService]:
    yield RAGService(db)


RAGServiceDep = Annotated[RAGService, Depends(get_rag_service)]


# --- Developer API (Sprint 5: observability — metrics, system status, logs, analytics) ---


async def get_developer_service(db: DbSessionDep) -> AsyncIterator[DeveloperService]:
    yield DeveloperService(db)


DeveloperServiceDep = Annotated[DeveloperService, Depends(get_developer_service)]


# --- Admin API (Sprint 6: user/dataset/knowledge-base/embedding/settings management,
# system monitoring, activity log — wired up in Sprint 7) ---


async def get_admin_user_service(db: DbSessionDep) -> AsyncIterator[AdminUserService]:
    yield AdminUserService(db)


AdminUserServiceDep = Annotated[AdminUserService, Depends(get_admin_user_service)]


async def get_dataset_management_service(
    db: DbSessionDep,
) -> AsyncIterator[DatasetManagementService]:
    yield DatasetManagementService(db)


DatasetManagementServiceDep = Annotated[
    DatasetManagementService, Depends(get_dataset_management_service)
]


async def get_admin_knowledge_base_service(
    db: DbSessionDep,
) -> AsyncIterator[AdminKnowledgeBaseService]:
    yield AdminKnowledgeBaseService(db)


AdminKnowledgeBaseServiceDep = Annotated[
    AdminKnowledgeBaseService, Depends(get_admin_knowledge_base_service)
]


async def get_admin_embedding_service(db: DbSessionDep) -> AsyncIterator[AdminEmbeddingService]:
    yield AdminEmbeddingService(db)


AdminEmbeddingServiceDep = Annotated[AdminEmbeddingService, Depends(get_admin_embedding_service)]


async def get_admin_settings_service(db: DbSessionDep) -> AsyncIterator[AdminSettingsService]:
    yield AdminSettingsService(db)


AdminSettingsServiceDep = Annotated[AdminSettingsService, Depends(get_admin_settings_service)]


async def get_admin_monitoring_service() -> AsyncIterator[AdminMonitoringService]:
    yield AdminMonitoringService()


AdminMonitoringServiceDep = Annotated[
    AdminMonitoringService, Depends(get_admin_monitoring_service)
]


async def get_admin_activity_log_service(
    db: DbSessionDep,
) -> AsyncIterator[AdminActivityLogService]:
    yield AdminActivityLogService(db)


AdminActivityLogServiceDep = Annotated[
    AdminActivityLogService, Depends(get_admin_activity_log_service)
]


# --- Evaluation API (Sprint 7: classification + RAG metrics) ---


async def get_evaluation_service(db: DbSessionDep) -> AsyncIterator[EvaluationService]:
    yield EvaluationService(db)


EvaluationServiceDep = Annotated[EvaluationService, Depends(get_evaluation_service)]


# --- Reports API (Sprint 7: PDF/JSON prediction + evaluation reports) ---


async def get_report_service(db: DbSessionDep) -> AsyncIterator[ReportService]:
    yield ReportService(db)


ReportServiceDep = Annotated[ReportService, Depends(get_report_service)]
