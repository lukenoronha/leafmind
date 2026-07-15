"""PasswordResetToken model — single-use, expiring tokens for the forgot/reset
password flow.

Mirrors RefreshToken's pattern (hashed storage, expiry, revocation) but adds
`is_used` since a reset token is consumed exactly once, unlike a refresh
token which is rotated on each use.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class PasswordResetToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single issued password-reset token."""

    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship()

    # SHA-256 hex digest of the raw token — the raw value is never persisted
    # (same rationale as RefreshToken.token_hash).
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<PasswordResetToken id={self.id} user_id={self.user_id} used={self.is_used}>"
