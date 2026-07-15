"""Request/response schemas for the authentication API."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import PasswordPolicyError, validate_password_strength

if TYPE_CHECKING:
    from app.models.user import User


class _PasswordValidatedModel(BaseModel):
    """Base model that runs the shared password-complexity policy on `password`."""

    password: str = Field(..., min_length=1, max_length=128, exclude=True)

    @field_validator("password")
    @classmethod
    def _check_password_policy(cls, value: str) -> str:
        try:
            validate_password_strength(value)
        except PasswordPolicyError as exc:
            raise ValueError(str(exc)) from exc
        return value


class RegisterRequest(_PasswordValidatedModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=150)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(_PasswordValidatedModel):
    current_password: str = Field(..., min_length=1, max_length=128)

    @field_validator("password")
    @classmethod
    def _new_password_differs(cls, value: str, info):
        current = info.data.get("current_password")
        if current is not None and value == current:
            raise ValueError("New password must be different from the current password.")
        return value


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(_PasswordValidatedModel):
    token: str


class TokenResponse(BaseModel):
    """Issued on successful login/refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime, in seconds.")


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: RoleResponse
    is_active: bool
    is_verified: bool
    created_at: datetime
    avatar_url: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user: "User", *, request_base_url: str) -> "UserResponse":
        """Build a response including a computed `avatar_url`.

        `avatar_url` isn't a plain column on `User` (it stores `avatar_path`,
        a relative on-disk path — see the model's docstring), so plain
        `model_validate(user)` can't populate it. Every endpoint returning a
        `UserResponse` should go through this instead of `model_validate`
        directly, so the field is never silently left `None` for a user who
        does have an avatar.
        """
        from app.services.auth.service import AuthService

        response = cls.model_validate(user)
        response.avatar_url = AuthService.build_avatar_url(
            request_base_url=request_base_url, avatar_path=user.avatar_path
        )
        return response


class UpdateProfileRequest(BaseModel):
    """`full_name` only — email/password changes go through their own
    dedicated flows (register-time email is immutable; see
    ChangePasswordRequest for passwords). Avatar upload is a separate
    multipart endpoint, not part of this JSON body.
    """

    full_name: str = Field(..., min_length=1, max_length=150)


class MessageResponse(BaseModel):
    message: str
