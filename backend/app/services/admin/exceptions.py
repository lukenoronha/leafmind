"""Domain exceptions for the admin service layer — mirrors `AuthError`/`RAGError`/`DeveloperError`."""

from app.core.exceptions import LeafMindError


class AdminError(LeafMindError):
    """Base class for admin-layer failures."""


class UserNotFoundError(AdminError):
    def __init__(self) -> None:
        super().__init__("User not found.", status_code=404)


class CannotModifySelfError(AdminError):
    def __init__(self, message: str = "Admins cannot perform this action on their own account.") -> None:
        super().__init__(message, status_code=400)


class DatasetClassNotFoundError(AdminError):
    def __init__(self) -> None:
        super().__init__("Dataset class not found.", status_code=404)


class DatasetUploadError(AdminError):
    def __init__(self, message: str) -> None:
        super().__init__(f"Dataset upload failed: {message}", status_code=422)


class SettingNotFoundError(AdminError):
    def __init__(self) -> None:
        super().__init__("Setting not found.", status_code=404)


class InvalidSettingValueError(AdminError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)
