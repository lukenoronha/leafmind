import { apiClient } from '@/lib/api-client'
import type { AuthTokens, AuthUser } from '@/types/auth'

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  name: string
  email: string
  password: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  password: string
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser
}

/**
 * Auth service mirroring the FastAPI auth router from Sprint 1. These
 * endpoints are placeholders — the backend does not exist yet, so
 * every call here will fail until it's implemented.
 */
export const authService = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload),

  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>('/auth/signup', payload),

  logout: () => apiClient.post<void>('/auth/logout'),

  getCurrentUser: () => apiClient.get<AuthUser>('/auth/me'),

  refreshToken: (refreshToken: string) =>
    apiClient.post<AuthTokens>('/auth/refresh', { refreshToken }),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiClient.post<void>('/auth/forgot-password', payload),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<void>('/auth/reset-password', payload),
}
