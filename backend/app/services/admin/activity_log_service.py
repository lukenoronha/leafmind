"""AdminActivityLogService — paginated/filtered query and CSV export over `AdminActivityLog`.

Distinct from `app.services.developer.log_reader.LogReader` (Sprint 5's
generic Loguru process-log reader): this queries the actor-scoped
`admin_activity_log` DB table written by every other admin service method
via `app.services.admin.audit.record_activity`.
"""

import csv
import io

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_activity_log import AdminActivityLog
from app.models.user import User


class AdminActivityLogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_activity(
        self,
        *,
        actor_email: str | None = None,
        action: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[tuple[AdminActivityLog, User]], int]:
        query = select(AdminActivityLog, User).join(User, AdminActivityLog.actor_user_id == User.id)
        count_query = select(AdminActivityLog).join(User, AdminActivityLog.actor_user_id == User.id)

        if actor_email is not None:
            query = query.where(User.email == actor_email)
            count_query = count_query.where(User.email == actor_email)
        if action is not None:
            query = query.where(AdminActivityLog.action == action)
            count_query = count_query.where(AdminActivityLog.action == action)

        total = (
            await self.db.execute(select(func.count()).select_from(count_query.subquery()))
        ).scalar_one()

        result = await self.db.execute(
            query.order_by(AdminActivityLog.created_at.desc()).limit(limit).offset(offset)
        )
        return [(entry, actor) for entry, actor in result.all()], total

    async def export_csv(
        self, *, actor_email: str | None = None, action: str | None = None
    ) -> str:
        """Returns the full (unpaginated, up to a hard cap) matching activity as CSV text."""
        entries, _ = await self.list_activity(
            actor_email=actor_email, action=action, limit=10_000, offset=0
        )

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["timestamp", "actor_email", "action", "target_type", "target_id", "details"])
        for entry, actor in entries:
            writer.writerow(
                [
                    entry.created_at.isoformat(),
                    actor.email,
                    entry.action,
                    entry.target_type or "",
                    entry.target_id or "",
                    entry.details or "",
                ]
            )
        return buffer.getvalue()
