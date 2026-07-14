import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AppSetting } from '@/types/admin'

const SETTINGS_QUERY_KEY = ['admin', 'settings'] as const

export function useAdminSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await adminService.getSettings()
      return data
    },
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
