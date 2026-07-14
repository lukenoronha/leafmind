"""Shared audit-logging helper for the admin service layer.

Every mutating admin service method calls `record_activity()` in the same
DB transaction as its own change, so an admin action and its audit row are
committed together — there's no separate "logging service" call that could
fail independently and leave an unaudited mutation.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_activity_log import AdminActivityLog


async def record_activity(
    db: AsyncSession,
    *,
    actor_user_id: uuid.UUID,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> AdminActivityLog:
    """Adds an `AdminActivityLog` row to the session. Does not commit —
    the caller commits as part of its own unit of work."""
    entry = AdminActivityLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    return entry
