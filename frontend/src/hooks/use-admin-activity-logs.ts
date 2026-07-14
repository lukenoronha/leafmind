import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ActivityLogFilters } from '@/types/admin'

export function useActivityLogs(filters: ActivityLogFilters) {
  return useQuery({
    queryKey: ['admin', 'activity-logs', filters],
    queryFn: () => adminService.getActivityLogs(filters),
    placeholderData: (previousData) => previousData,
  })
}

export function useExportActivityLogs() {
  return useMutation({
    mutationFn: (filters: Omit<ActivityLogFilters, 'limit' | 'offset'>) =>
      adminService.exportActivityLogs(filters),
    onSuccess: ({ data }) => {
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `leafmind-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Activity logs exported.')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to export activity logs.'))
    },
  })
}
