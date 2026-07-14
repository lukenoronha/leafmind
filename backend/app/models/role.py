"""Role model — backs Role-Based Access Control (RBAC).

Roles are stored as rows (not a hardcoded enum column) so that new roles can be
added operationally without a schema migration, while `RoleName` gives routers
and services a typed, IDE-discoverable set of the roles this sprint ships with.
"""

import enum
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class RoleName(str, enum.Enum):
    """Canonical role identifiers used across the application."""

    USER = "user"
    DEVELOPER = "developer"
    ADMIN = "admin"


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A named permission tier assigned to users (e.g. user, developer, admin)."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="role")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<Role id={self.id} name={self.name!r}>"
