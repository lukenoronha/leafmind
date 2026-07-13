"""Authentication & authorization endpoints.

Thin HTTP layer over `AuthService` — all business logic (hashing, token
issuance/rotation, revocation) lives in `app.services.auth.AuthService`.
"""

from fastapi import APIRouter, status
from loguru import logger

from app.api.deps import AuthServiceDep, CurrentUserDep
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user account with the default 'user' role. "
    "Passwords are hashed with bcrypt before storage.",
)
async def register(payload: RegisterRequest, auth_service: AuthServiceDep) -> UserResponse:
    user = await auth_service.register(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain a token pair",
    description="Validates credentials and returns a short-lived access token "
    "plus a long-lived refresh token.",
)
async def login(payload: LoginRequest, auth_service: AuthServiceDep) -> TokenResponse:
    return await auth_service.login(email=payload.email, password=payload.password)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke a refresh token",
    description="Revokes the given refresh token, ending that session. "
    "The corresponding access token remains valid until it naturally expires.",
)
async def logout(payload: LogoutRequest, auth_service: AuthServiceDep) -> MessageResponse:
    await auth_service.logout(raw_refresh_token=payload.refresh_token)
    return MessageResponse(message="Logged out successfully.")


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new token pair",
    description="Validates the refresh token, revokes it, and issues a new "
    "access/refresh pair (rotation). Reusing a revoked refresh token is rejected.",
)
async def refresh(payload: RefreshRequest, auth_service: AuthServiceDep) -> TokenResponse:
    return await auth_service.refresh(raw_refresh_token=payload.refresh_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the current authenticated user",
    description="Returns the profile of the user identified by the bearer access token.",
)
async def get_me(current_user: CurrentUserDep) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put(
    "/change-password",
    response_model=MessageResponse,
    summary="Change the current user's password",
    description="Requires the current password for verification. On success, "
    "all of the user's refresh tokens are revoked, forcing re-login on other sessions.",
)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> MessageResponse:
    await auth_service.change_password(
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.password,
    )
    return MessageResponse(message="Password changed successfully. Please log in again.")
