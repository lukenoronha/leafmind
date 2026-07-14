"""AdminSettingsService — DB-persisted admin-configurable setting overrides.

See `app.models.app_setting.AppSetting` for the scope/contract: this service
lets admins record intended values for a fixed allow-list of parameters
(RAG Top-K, similarity threshold, upload limits, session timeout, default
model version) and review the "current effective config" (DB override if
present, else the static `Settings` default). It does not mutate
`app.core.config.settings`, and nothing in `app/rag/`, `app/inference/`, or
`app/services/rag/` reads from this table — wiring these overrides into live
pipeline behavior is an explicit, separate follow-up.
"""

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.app_setting import AppSetting
from app.models.user import User
from app.services.admin.audit import record_activity
from app.services.admin.exceptions import InvalidSettingValueError, SettingNotFoundError


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    value_type: type
    default_factory: Callable[[], object]
    description: str


def _settings_registry(settings: Settings) -> dict[str, SettingDefinition]:
    """The fixed allow-list of admin-configurable parameters.

    Deliberately a closed set (not "any Settings field") so admins can't
    accidentally expose/mutate secrets (`JWT_SECRET_KEY`) or structural
    config (`DATABASE_URL`) through this API.
    """
    return {
        "rag_top_k": SettingDefinition(
            "rag_top_k", int, lambda: settings.RAG_TOP_K, "Number of chunks retrieved per RAG query."
        ),
        "rag_similarity_threshold": SettingDefinition(
            "rag_similarity_threshold",
            float,
            lambda: settings.RAG_SIMILARITY_THRESHOLD,
            "Minimum similarity score for a retrieved chunk to be used.",
        ),
        "max_upload_size_mb": SettingDefinition(
            "max_upload_size_mb",
            int,
            lambda: settings.MAX_UPLOAD_SIZE_MB,
            "Maximum allowed image upload size, in megabytes.",
        ),
        "max_document_upload_size_mb": SettingDefinition(
            "max_document_upload_size_mb",
            int,
            lambda: settings.MAX_DOCUMENT_UPLOAD_SIZE_MB,
            "Maximum allowed PDF upload size, in megabytes.",
        ),
        "session_timeout_minutes": SettingDefinition(
            "session_timeout_minutes",
            int,
            lambda: settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
            "Access token lifetime, in minutes.",
        ),
        "default_model_version": SettingDefinition(
            "default_model_version",
            str,
            lambda: settings.VLM_MODEL_NAME,
            "Default Vision-Language Model identifier.",
        ),
    }


class AdminSettingsService:
    def __init__(self, db: AsyncSession, *, settings: Settings | None = None):
        self.db = db
        self._settings = settings or get_settings()
        self._registry = _settings_registry(self._settings)

    async def list_settings(self) -> list[dict]:
        overrides = await self._load_overrides()
        return [self._effective_value(definition, overrides) for definition in self._registry.values()]

    async def get_setting(self, *, key: str) -> dict:
        definition = self._registry.get(key)
        if definition is None:
            raise SettingNotFoundError()
        overrides = await self._load_overrides()
        return self._effective_value(definition, overrides)

    async def update_setting(self, *, actor: User, key: str, value: str) -> dict:
        definition = self._registry.get(key)
        if definition is None:
            raise SettingNotFoundError()

        parsed = self._parse_and_validate(definition, value)

        result = await self.db.execute(select(AppSetting).where(AppSetting.key == key))
        row = result.scalar_one_or_none()
        old_value = str(parsed) if row is None else row.value

        if row is None:
            row = AppSetting(
                key=key,
                value=str(parsed),
                value_type=definition.value_type.__name__,
                updated_by=actor.email,
            )
            self.db.add(row)
        else:
            row.value = str(parsed)
            row.updated_by = actor.email

        await record_activity(
            self.db,
            actor_user_id=actor.id,
            action="settings.update",
            target_type="app_setting",
            target_id=key,
            details={"old_value": old_value, "new_value": str(parsed)},
        )
        await self.db.commit()

        overrides = await self._load_overrides()
        return self._effective_value(definition, overrides)

    async def reset_setting(self, *, actor: User, key: str) -> dict:
        definition = self._registry.get(key)
        if definition is None:
            raise SettingNotFoundError()

        result = await self.db.execute(select(AppSetting).where(AppSetting.key == key))
        row = result.scalar_one_or_none()
        if row is not None:
            await self.db.delete(row)
            await record_activity(
                self.db,
                actor_user_id=actor.id,
                action="settings.reset",
                target_type="app_setting",
                target_id=key,
            )
            await self.db.commit()

        overrides = await self._load_overrides()
        return self._effective_value(definition, overrides)

    async def _load_overrides(self) -> dict[str, AppSetting]:
        result = await self.db.execute(select(AppSetting))
        return {row.key: row for row in result.scalars().all()}

    def _effective_value(self, definition: SettingDefinition, overrides: dict[str, AppSetting]) -> dict:
        override = overrides.get(definition.key)
        if override is not None:
            value = definition.value_type(override.value)
            is_overridden = True
            updated_by = override.updated_by
            updated_at = override.updated_at
        else:
            value = definition.default_factory()
            is_overridden = False
            updated_by = None
            updated_at = None

        return {
            "key": definition.key,
            "value": value,
            "default_value": definition.default_factory(),
            "is_overridden": is_overridden,
            "description": definition.description,
            "updated_by": updated_by,
            "updated_at": updated_at,
        }

    @staticmethod
    def _parse_and_validate(definition: SettingDefinition, raw_value: str):
        try:
            parsed = definition.value_type(raw_value)
        except (TypeError, ValueError) as exc:
            raise InvalidSettingValueError(
                f"'{definition.key}' expects a {definition.value_type.__name__}, got {raw_value!r}."
            ) from exc

        if definition.key == "rag_similarity_threshold" and not (0.0 <= parsed <= 1.0):
            raise InvalidSettingValueError("rag_similarity_threshold must be between 0.0 and 1.0.")
        if definition.key == "rag_top_k" and parsed < 1:
            raise InvalidSettingValueError("rag_top_k must be at least 1.")
        positive_int_keys = {"max_upload_size_mb", "max_document_upload_size_mb", "session_timeout_minutes"}
        if definition.key in positive_int_keys and parsed < 1:
            raise InvalidSettingValueError(f"'{definition.key}' must be a positive integer.")

        return parsed
