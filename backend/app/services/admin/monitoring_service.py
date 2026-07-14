"""AdminMonitoringService — system-wide status for the admin System Monitoring endpoint.

Reuses `app.services.developer.system_metrics` (Sprint 5) directly — it's
already pure, read-only, and never loads a model — plus `check_database_connection()`
and `ChromaVectorStore.count()`/`get_collection_info()`. The only new signal is
process uptime (`app.core.uptime`), which Sprint 5 didn't track. This service
intentionally does not duplicate `DeveloperService.get_system_status()`; the
admin System Monitoring endpoint composes the same underlying primitives
directly rather than importing `DeveloperService`, to keep the admin and
developer layers independently gated without a cross-dependency.
"""

from app.core.uptime import get_uptime_seconds
from app.db.session import check_database_connection
from app.rag.vectorstore import VectorStore, get_vector_store
from app.services.developer import system_metrics


class AdminMonitoringService:
    def __init__(self, *, vector_store: VectorStore | None = None):
        self._vector_store = vector_store or get_vector_store()

    async def get_system_status(self) -> dict:
        db_healthy = await check_database_connection()

        try:
            collection_info = self._vector_store.get_collection_info()
            chromadb_healthy = True
        except Exception:
            collection_info = {
                "name": None,
                "vector_count": 0,
                "persist_dir": None,
                "distance_metric": None,
            }
            chromadb_healthy = False

        models = system_metrics.get_model_availability()
        resources = system_metrics.get_resource_usage()

        return {
            "backend_healthy": True,
            "uptime_seconds": round(get_uptime_seconds(), 2),
            "database_healthy": db_healthy,
            "chromadb_healthy": chromadb_healthy,
            "chromadb_collection": collection_info,
            "vlm_model_loaded": models.vlm_loaded,
            "embedding_model_loaded": models.embedding_loaded,
            "cpu_percent": resources.cpu_percent,
            "memory_total_mb": resources.memory_total_mb,
            "memory_used_mb": resources.memory_used_mb,
            "memory_percent": resources.memory_percent,
            "disk_total_gb": resources.disk_total_gb,
            "disk_used_gb": resources.disk_used_gb,
            "disk_percent": resources.disk_percent,
        }
