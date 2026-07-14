import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/services/admin.service'

const REFRESH_INTERVAL_MS = 30_000

export function useAdminSystemStatus() {
  return useQuery({
    queryKey: ['admin', 'system', 'status'],
    queryFn: async () => {
      const { data } = await adminService.getSystemStatus()
      return data
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
