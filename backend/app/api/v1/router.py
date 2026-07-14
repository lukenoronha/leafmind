"""Aggregates all v1 endpoint routers under a single APIRouter."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_activity_log,
    admin_datasets,
    admin_embeddings,
    admin_knowledge_base,
    admin_monitoring,
    admin_settings,
    admin_users,
    auth,
    developer,
    documents,
    evaluation,
    health,
    images,
    rag,
    reports,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(images.router)
api_router.include_router(rag.router)
api_router.include_router(documents.router)
api_router.include_router(developer.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_datasets.router)
api_router.include_router(admin_knowledge_base.router)
api_router.include_router(admin_embeddings.router)
api_router.include_router(admin_settings.router)
api_router.include_router(admin_monitoring.router)
api_router.include_router(admin_activity_log.router)
api_router.include_router(evaluation.router)
api_router.include_router(reports.router)
