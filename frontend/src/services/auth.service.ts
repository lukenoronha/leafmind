import { apiClient } from '@/lib/api-client'
import type { AuthTokens, AuthUser, UserRole } from '@/types/auth'
import { tokenStorage } from '@/lib/token-storage'

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

// --- Backend Schemas ---
interface BackendTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface BackendUserResponse {
  id: string
  email: string
  full_name: string
  role: { id: string; name: string }
  is_active: boolean
  is_verified: boolean
  created_at: string
  avatar_url: string | null
}
// -----------------------

export const authService = {
  login: async (payload: LoginPayload): Promise<{ data: AuthResponse }> => {
    const { data: tokens } = await apiClient.post<BackendTokenResponse>('/auth/login', payload)
    
    // Explicitly pass the new access token to fetch the user profile
    const { data: backendUser } = await apiClient.get<BackendUserResponse>('/auth/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    return {
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: {
          id: backendUser.id,
          name: backendUser.full_name,
          email: backendUser.email,
          role: backendUser.role.name as UserRole,
          memberSince: backendUser.created_at,
          avatarUrl: backendUser.avatar_url ?? undefined,
        }
      }
    }
  },

  signup: async (payload: SignupPayload): Promise<{ data: AuthResponse }> => {
    // 1. Register with the backend schema (full_name instead of name)
    await apiClient.post('/auth/register', {
      email: payload.email,
      full_name: payload.name,
      password: payload.password
    })
    
    // 2. The backend doesn't return tokens on registration, so we log in immediately
    return authService.login({
      email: payload.email,
      password: payload.password
    })
  },

  logout: async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (refreshToken) {
      // Backend requires the refresh token in the body for revocation
      await apiClient.post<void>('/auth/logout', { refresh_token: refreshToken })
    }
  },

  getCurrentUser: async (): Promise<{ data: AuthUser }> => {
    const { data: backendUser } = await apiClient.get<BackendUserResponse>('/auth/me')
    return {
      data: {
        id: backendUser.id,
        name: backendUser.full_name,
        email: backendUser.email,
        role: backendUser.role.name as UserRole,
        memberSince: backendUser.created_at,
        avatarUrl: backendUser.avatar_url ?? undefined,
      }
    }
  },

  refreshToken: async (refreshToken: string): Promise<{ data: AuthTokens }> => {
    const { data: tokens } = await apiClient.post<BackendTokenResponse>('/auth/refresh', {
      refresh_token: refreshToken
    })
    return {
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      }
    }
  },

  // Stubs for forgot/reset password since the backend doesn't implement them
  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiClient.post<void>('/auth/forgot-password', payload),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<void>('/auth/reset-password', payload),
}
