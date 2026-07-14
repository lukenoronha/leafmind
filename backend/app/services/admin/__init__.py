"""Admin service layer (Sprint 6) — user management, dataset management, knowledge
base admin, embedding management, settings, system monitoring, and activity log.

Each service is a thin, additive layer: mutating operations wrap already-existing
collaborators (`RAGService`, `ChromaVectorStore`, `DatasetLoader`) where possible
and write an `AdminActivityLog` row via `app.services.admin.audit.record_activity`
in the same transaction as the change they perform.
"""

from app.services.admin.activity_log_service import AdminActivityLogService
from app.services.admin.dataset_service import DatasetManagementService
from app.services.admin.embedding_service import AdminEmbeddingService
from app.services.admin.knowledge_base_service import AdminKnowledgeBaseService
from app.services.admin.monitoring_service import AdminMonitoringService
from app.services.admin.settings_service import AdminSettingsService
from app.services.admin.user_service import AdminUserService

__all__ = [
    "AdminUserService",
    "DatasetManagementService",
    "AdminKnowledgeBaseService",
    "AdminEmbeddingService",
    "AdminSettingsService",
    "AdminMonitoringService",
    "AdminActivityLogService",
]
