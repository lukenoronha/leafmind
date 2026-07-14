"""Shared pytest fixtures — an isolated in-memory SQLite DB per test.

Uses SQLite instead of the production PostgreSQL so the auth test suite has
no external service dependency. Models are backend-agnostic (see
`app.models.mixins.GUID`), so behavior tested here reflects real ORM/service
logic, not a mock.
"""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.deps import get_developer_service, get_image_analysis_service, get_rag_service
from app.db.base import Base
from app.db.session import get_db_session
from app.inference.vlm.pipeline import VLMInferencePipeline
from app.main import app
from app.models.role import Role, RoleName
from app.models.user import User
from app.rag.retriever import Retriever
from app.services.developer import DeveloperService
from app.services.image_analysis import ImageAnalysisService
from app.services.rag import RAGService
from tests.fakes import FakeEmbeddingBackend, FakeVectorStore, FakeVLMBackend

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


@pytest.fixture
def fake_embedding_backend() -> FakeEmbeddingBackend:
    return FakeEmbeddingBackend()


@pytest.fixture
def fake_vector_store() -> FakeVectorStore:
    return FakeVectorStore()


@pytest_asyncio.fixture
async def client(
    db_session_factory, fake_vlm_backend, fake_embedding_backend, fake_vector_store, tmp_path
) -> AsyncIterator[AsyncClient]:
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

    async def _override_get_rag_service():
        async with db_session_factory() as session:
            from app.core.config import Settings
            from app.documents.storage import DocumentStorage
            from app.images.storage import ImageStorage
            from app.rag.pipeline import RAGIngestionPipeline

            settings = Settings(
                UPLOAD_DIR=str(tmp_path / "uploads"),
                DOCUMENT_UPLOAD_DIR=str(tmp_path / "documents"),
            )
            yield RAGService(
                session,
                settings=settings,
                image_storage=ImageStorage(settings),
                document_storage=DocumentStorage(settings),
                inference=VLMInferencePipeline(backend=fake_vlm_backend),
                retriever=Retriever(
                    embedding_backend=fake_embedding_backend,
                    vector_store=fake_vector_store,
                    settings=settings,
                ),
                ingestion_pipeline=RAGIngestionPipeline(
                    embedding_backend=fake_embedding_backend,
                    vector_store=fake_vector_store,
                    settings=settings,
                ),
                vector_store=fake_vector_store,
            )

    async def _override_get_developer_service():
        async with db_session_factory() as session:
            from app.core.config import Settings

            settings = Settings(LOG_DIR=str(tmp_path / "logs"))
            yield DeveloperService(session, settings=settings, vector_store=fake_vector_store)

    app.dependency_overrides[get_db_session] = _override_get_db_session
    app.dependency_overrides[get_image_analysis_service] = _override_get_image_analysis_service
    app.dependency_overrides[get_rag_service] = _override_get_rag_service
    app.dependency_overrides[get_developer_service] = _override_get_developer_service

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


@pytest_asyncio.fixture
async def developer_headers(client: AsyncClient, db_session_factory) -> dict[str, str]:
    """Registers a fresh user, promotes them to the `developer` role directly in
    the DB (registration always assigns `DEFAULT_USER_ROLE`), then logs in.
    """
    email = "dev_tester@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": VALID_PASSWORD, "full_name": "Dev Tester"},
    )

    async with db_session_factory() as session:
        developer_role = (
            await session.execute(select(Role).where(Role.name == RoleName.DEVELOPER.value))
        ).scalar_one()
        user = (await session.execute(select(User).where(User.email == email))).scalar_one()
        user.role_id = developer_role.id
        await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD}
    )
    access_token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}
