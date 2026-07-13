import { apiClient } from '@/lib/api-client'
import type { AuthUser } from '@/types/auth'

/**
 * Placeholder user service, mirrors the future FastAPI user router.
 */
export const userService = {
  getProfile: () => apiClient.get<AuthUser>('/users/me'),

  updateProfile: (payload: Partial<Pick<AuthUser, 'name' | 'avatarUrl'>>) =>
    apiClient.patch<AuthUser>('/users/me', payload),
}
