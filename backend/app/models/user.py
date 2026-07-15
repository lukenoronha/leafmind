"""User model — core identity record for authentication and authorization."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken
    from app.models.role import Role


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An application user.

    Passwords are never stored in plaintext — only the bcrypt hash
    (`hashed_password`) is persisted. See `app.core.security` for hashing.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relative on-disk path (e.g. "uploads/avatars/<uuid>.jpg"), mirroring
    # UploadedImage.stored_path — NULL until the user uploads one. The
    # public URL served to clients is derived from this at response time
    # (see AuthService._build_avatar_url), not stored directly, so it stays
    # correct if the app's public host/scheme ever changes.
    avatar_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    role: Mapped["Role"] = relationship(back_populates="users", lazy="joined")

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<User id={self.id} email={self.email!r}>"
