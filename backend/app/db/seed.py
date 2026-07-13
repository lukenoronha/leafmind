"""Idempotent startup seed data — currently just the fixed RBAC role set.

Roles are data (rows), not an enum column, so they can be extended later
without a migration; this seed guarantees the three roles this sprint
requires always exist, even against a freshly migrated empty database.
"""

from loguru import logger
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.role import Role, RoleName

_ROLE_DESCRIPTIONS: dict[RoleName, str] = {
    RoleName.USER: "Standard end user with access to core LeafMind features.",
    RoleName.DEVELOPER: "Elevated access for internal tooling and diagnostics.",
    RoleName.ADMIN: "Full administrative access.",
}


async def seed_roles() -> None:
    """Insert any missing default roles. Safe to call on every startup."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Role.name))
        existing_names = {row[0] for row in result.all()}

        created = []
        for role in RoleName:
            if role.value not in existing_names:
                session.add(Role(name=role.value, description=_ROLE_DESCRIPTIONS[role]))
                created.append(role.value)

        if created:
            await session.commit()
            logger.info("Seeded default roles: {}", ", ".join(created))
        else:
            logger.debug("Default roles already present — nothing to seed.")
