"""SQLAlchemy ORM models.

Every model module is imported here so that:
  1. `Base.metadata` is fully populated for Alembic autogenerate.
  2. Relationship string references (e.g. "User") resolve correctly.
"""

from app.models.admin_activity_log import AdminActivityLog
from app.models.app_setting import AppSetting
from app.models.chat_message import ChatMessage, ChatRole
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
from app.models.evaluation_run import EvaluationRun, EvaluationRunType
from app.models.prediction import Prediction
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.uploaded_image import UploadedImage
from app.models.user import User

__all__ = [
    "User",
    "Role",
    "RefreshToken",
    "UploadedImage",
    "Prediction",
    "ChatMessage",
    "ChatRole",
    "Document",
    "DocumentStatus",
    "DocumentChunk",
    "AdminActivityLog",
    "AppSetting",
    "EvaluationRun",
    "EvaluationRunType",
]
