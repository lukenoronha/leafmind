import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AccountStatus, UserFilters } from '@/types/admin'

const USERS_QUERY_KEY = ['admin', 'users'] as const

export function useAdminUsers(filters: UserFilters & { search?: string }) {
  const { search, ...serverFilters } = filters
  const query = useQuery({
    queryKey: [...USERS_QUERY_KEY, serverFilters],
    queryFn: () => adminService.getUsers(serverFilters),
  })

  // The backend has no free-text search param (only role/is_active) — filter
  // the already-fetched, server-filtered page client-side instead of
  // silently dropping the search box.
  const filtered = search?.trim()
    ? query.data?.filter(
        (user) =>
          user.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          user.email.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : query.data

  return { ...query, data: filtered }
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string
      status: AccountStatus
    }) => adminService.setUserStatus(userId, status),
    onSuccess: (_result, { status }) => {
      toast.success(
        status === 'active' ? 'Account activated.' : 'Account deactivated.',
      )
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to update account status.'))
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted.')
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to delete user.'))
    },
  })
}
