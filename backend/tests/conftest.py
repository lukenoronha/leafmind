"""Shared pytest fixtures — an isolated in-memory SQLite DB per test.

Uses SQLite instead of the production PostgreSQL so the auth test suite has
no external service dependency. Models are backend-agnostic (see
`app.models.mixins.GUID`), so behavior tested here reflects real ORM/service
logic, not a mock.
"""

import asyncio
from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.deps import get_chat_service, get_image_analysis_service
from app.chat import ChatService
from app.db.base import Base
from app.db.session import get_db_session
from app.inference.vlm.pipeline import VLMInferencePipeline
from app.main import app
from app.models.role import Role, RoleName
from app.services.image_analysis import ImageAnalysisService
from tests.fakes import FakeVLMBackend

_TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

VALID_PASSWORD = "Str0ng!Pass"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(_TEST_DATABASE_URL, poolclass=None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session_factory(db_engine):
    return async_sessionmaker(bind=db_engine, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def _seed_roles(db_session_factory):
    async with db_session_factory() as session:
        for role in RoleName:
            session.add(Role(name=role.value, description=f"{role.value} role"))
        await session.commit()


@pytest.fixture
def fake_vlm_backend() -> FakeVLMBackend:
    return FakeVLMBackend()


@pytest_asyncio.fixture
async def client(db_session_factory, fake_vlm_backend, tmp_path) -> AsyncIterator[AsyncClient]:
    async def _override_get_db_session():
        async with db_session_factory() as session:
            yield session

    async def _override_get_image_analysis_service():
        async with db_session_factory() as session:
            from app.core.config import Settings
            from app.images.storage import ImageStorage

            settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
            yield ImageAnalysisService(
                session,
                storage=ImageStorage(settings),
                inference=VLMInferencePipeline(backend=fake_vlm_backend),
            )

    async def _override_get_chat_service():
        async with db_session_factory() as session:
            from app.core.config import Settings
            from app.images.storage import ImageStorage

            settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
            yield ChatService(
                session,
                settings=settings,
                storage=ImageStorage(settings),
                inference=VLMInferencePipeline(backend=fake_vlm_backend),
            )

    app.dependency_overrides[get_db_session] = _override_get_db_session
    app.dependency_overrides[get_image_analysis_service] = _override_get_image_analysis_service
    app.dependency_overrides[get_chat_service] = _override_get_chat_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Registers and logs in a fresh user, returning ready-to-use auth headers."""
    email = "leaf_tester@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": VALID_PASSWORD, "full_name": "Leaf Tester"},
    )
    login_response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD}
    )
    access_token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}
