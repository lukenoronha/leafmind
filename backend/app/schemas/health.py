"""Response schemas for health and status endpoints."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    timestamp: datetime = Field(default_factory=_utcnow)


class DependencyStatus(BaseModel):
    name: str
    healthy: bool
    detail: str | None = None


class StatusResponse(BaseModel):
    app_name: str
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=_utcnow)
    dependencies: list[DependencyStatus]
