"""Aggregates all v1 endpoint routers under a single APIRouter."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, developer, documents, health, images, rag

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(images.router)
api_router.include_router(rag.router)
api_router.include_router(documents.router)
api_router.include_router(developer.router)
