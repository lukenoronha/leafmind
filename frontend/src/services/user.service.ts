import { apiClient } from '@/lib/api-client'
import type { AuthUser } from '@/types/auth'

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

function toAuthUser(data: BackendUserResponse): AuthUser {
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    role: data.role.name as AuthUser['role'],
    memberSince: data.created_at,
    avatarUrl: data.avatar_url ?? undefined,
  }
}

/**
 * Consumed by the Profile page's mutations (hooks/use-profile.ts):
 * `updateProfile` backs the Profile Information form and `uploadAvatar`
 * backs the "Change avatar" button, wired to PATCH /auth/me and
 * POST /auth/me/avatar respectively.
 */
export const userService = {
  getProfile: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<BackendUserResponse>('/auth/me')
    return toAuthUser(data)
  },

  updateProfile: async (payload: { name: string }): Promise<AuthUser> => {
    const { data } = await apiClient.patch<BackendUserResponse>('/auth/me', {
      full_name: payload.name,
    })
    return toAuthUser(data)
  },

  uploadAvatar: async (file: File): Promise<AuthUser> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<BackendUserResponse>(
      '/auth/me/avatar',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return toAuthUser(data)
  },
}
