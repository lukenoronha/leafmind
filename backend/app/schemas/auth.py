"""Request/response schemas for the authentication API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import PasswordPolicyError, validate_password_strength


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

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
