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
}

function toAuthUser(data: BackendUserResponse): AuthUser {
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    role: data.role.name as AuthUser['role'],
  }
}

/**
 * Currently unused by any component (UserPage.tsx is a placeholder — see
 * its own comment). `getProfile` is wired to the real `/auth/me` endpoint
 * (same one `authService.getCurrentUser` uses) so it's usable once a real
 * profile page is built. `updateProfile` has no backend equivalent at all
 * (no PATCH /auth/me, no avatar_url field anywhere) and will 404 if ever
 * called — kept only as a documented placeholder for a future backend
 * feature, not a working call.
 */
export const userService = {
  getProfile: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<BackendUserResponse>('/auth/me')
    return toAuthUser(data)
  },

  /** No backend route exists for this (`PATCH /users/me` was never
   * implemented server-side, and `UserResponse` has no `avatar_url` field).
   * Will 404 if ever called. */
  updateProfile: (payload: Partial<Pick<AuthUser, 'name' | 'avatarUrl'>>) =>
    apiClient.patch<AuthUser>('/users/me', payload),
}
