import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AppSetting } from '@/types/admin'

const SETTINGS_QUERY_KEY = ['admin', 'settings'] as const

export function useAdminSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => adminService.getSettings(),
  })
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: AppSetting['value'] }) =>
      adminService.updateSetting(key, value),
    onSuccess: () => {
      toast.success('Setting updated.')
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to update setting.'))
    },
  })
}

export function useResetSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (key: string) => adminService.resetSetting(key),
    onSuccess: () => {
      toast.success('Setting reset to default.')
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to reset setting.'))
    },
  })
}
