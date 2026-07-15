"""Authentication & authorization endpoints.

Thin HTTP layer over `AuthService` — all business logic (hashing, token
issuance/rotation, revocation) lives in `app.services.auth.AuthService`.
"""

from fastapi import APIRouter, File, Request, UploadFile, status

from app.api.deps import AuthServiceDep, CurrentUserDep
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
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
async def register(
    payload: RegisterRequest, request: Request, auth_service: AuthServiceDep
) -> UserResponse:
    user = await auth_service.register(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return UserResponse.from_user(user, request_base_url=str(request.base_url))


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
async def get_me(current_user: CurrentUserDep, request: Request) -> UserResponse:
    return UserResponse.from_user(current_user, request_base_url=str(request.base_url))


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update the current user's profile",
    description="Currently supports updating the display name. Email and "
    "password changes go through their own dedicated flows.",
)
async def update_me(
    payload: UpdateProfileRequest,
    request: Request,
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
) -> UserResponse:
    user = await auth_service.update_profile(user=current_user, full_name=payload.full_name)
    return UserResponse.from_user(user, request_base_url=str(request.base_url))


@router.post(
    "/me/avatar",
    response_model=UserResponse,
    summary="Upload a profile avatar",
    description="Replaces the current user's avatar image. Accepts JPEG/PNG/WebP "
    "up to the configured size limit; the previous avatar (if any) is deleted.",
)
async def upload_avatar(
    request: Request,
    current_user: CurrentUserDep,
    auth_service: AuthServiceDep,
    file: UploadFile = File(..., description="JPEG/PNG/WebP avatar image."),
) -> UserResponse:
    raw_bytes = await file.read()
    user = await auth_service.upload_avatar(
        user=current_user,
        raw_bytes=raw_bytes,
        original_filename=file.filename or "avatar.jpg",
        content_type=file.content_type or "application/octet-stream",
    )
    return UserResponse.from_user(user, request_base_url=str(request.base_url))


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset link",
    description="Always returns success regardless of whether the email is "
    "registered, so this endpoint can't be used to enumerate accounts. If the "
    "email matches an active account, a single-use reset link is issued.",
)
async def forgot_password(
    payload: ForgotPasswordRequest, auth_service: AuthServiceDep
) -> MessageResponse:
    await auth_service.request_password_reset(email=payload.email)
    return MessageResponse(
        message="If an account exists for that email, we've sent a link to reset your password."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset a password using a reset link's token",
    description="Consumes a single-use token issued by /forgot-password. On "
    "success, all of the user's refresh tokens are revoked, forcing re-login "
    "on other sessions.",
)
async def reset_password(
    payload: ResetPasswordRequest, auth_service: AuthServiceDep
) -> MessageResponse:
    await auth_service.reset_password(raw_token=payload.token, new_password=payload.password)
    return MessageResponse(message="Password reset successfully. Please log in.")


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
