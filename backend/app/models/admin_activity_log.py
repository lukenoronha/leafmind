"""AdminActivityLog model — an actor-scoped audit trail of admin actions.

Distinct from the Sprint 5 `structured.jsonl` process-log sink (which is a
generic, non-queryable-by-actor stream of every log statement): every
mutating admin service method (user deactivation, dataset upload, knowledge
base reindex, settings change, ...) writes exactly one row here, so
"who did what, to what, when" is queryable and exportable independent of log
rotation/retention.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class AdminActivityLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One audited admin action."""

    __tablename__ = "admin_activity_log"

    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor: Mapped["User"] = relationship()

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(150), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<AdminActivityLog id={self.id} action={self.action!r} actor_user_id={self.actor_user_id}>"
