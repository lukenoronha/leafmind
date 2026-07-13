import { apiClient } from '@/lib/api-client'
import type { AuthUser } from '@/types/auth'

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
}

/**
 * Placeholder auth service. Endpoints mirror the future FastAPI auth
 * router but are not called anywhere yet — no backend exists.
 */
export const authService = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload),

  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>('/auth/signup', payload),

  logout: () => apiClient.post<void>('/auth/logout'),

  getCurrentUser: () => apiClient.get<AuthUser>('/auth/me'),
}
