"""Health and status endpoints — liveness/readiness for orchestration and monitoring."""

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.db.session import check_database_connection
from app.schemas.health import DependencyStatus, HealthResponse, StatusResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    description="Returns a minimal 200 OK if the application process is running.",
)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="Application status and dependency connectivity",
    description=(
        "Returns application metadata, environment, timestamp, and the connectivity "
        "state of downstream dependencies (currently: PostgreSQL)."
    ),
)
async def status_check(settings: SettingsDep) -> StatusResponse:
    db_healthy = await check_database_connection()

    return StatusResponse(
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        dependencies=[
            DependencyStatus(
                name="postgresql",
                healthy=db_healthy,
                detail=None if db_healthy else "Unable to connect to the database",
            ),
        ],
    )
