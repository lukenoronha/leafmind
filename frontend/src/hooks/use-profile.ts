import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import {
  authService,
  type ChangePasswordPayload,
} from '@/services/auth.service'
import { CURRENT_USER_QUERY_KEY } from '@/providers/auth-context'
import type { AuthUser } from '@/types/auth'

/**
 * Profile-page mutations, all wired to real backend endpoints:
 *   - PATCH /auth/me        (display name — the only editable field today)
 *   - POST  /auth/me/avatar (JPEG/PNG/WebP, max 5 MB server-side)
 *   - PUT   /auth/change-password
 * Successful profile/avatar updates write the returned user straight into
 * the auth query cache so the sidebar User Hub reflects the change
 * immediately, without a refetch.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string }) =>
      userService.updateProfile(payload),
    onSuccess: (user) => {
      queryClient.setQueryData<AuthUser>(CURRENT_USER_QUERY_KEY, user)
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => userService.uploadAvatar(file),
    onSuccess: (user) => {
      queryClient.setQueryData<AuthUser>(CURRENT_USER_QUERY_KEY, user)
    },
  })
}

/** No cache write here — the backend revokes all refresh tokens on
 * success, so the caller is expected to log the user out afterwards. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      authService.changePassword(payload),
  })
}
