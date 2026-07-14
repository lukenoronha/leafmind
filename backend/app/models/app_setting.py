"""AppSetting model — DB-persisted admin-configurable overrides.

Deliberately separate from `app.core.config.Settings` (the static, .env-loaded
pydantic-settings singleton every other module reads at call time): this
table is the admin-facing "current effective config" surface Sprint 6 exposes
for review/editing. Nothing outside `app/services/admin/` reads from this
table — in particular, the AI/RAG pipeline continues resolving configuration
exclusively via `app.core.config.settings`, unchanged. Wiring these
persisted overrides into live inference/retrieval behavior is an explicit,
separate follow-up, not part of this table's contract.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AppSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One admin-configurable key/value override, stored as its string representation."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    updated_by: Mapped[str | None] = mapped_column(String(320), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<AppSetting key={self.key!r} value={self.value!r}>"
