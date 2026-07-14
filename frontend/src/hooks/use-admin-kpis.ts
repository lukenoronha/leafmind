import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/services/admin.service'

const REFRESH_INTERVAL_MS = 30_000

export function useAdminKpis() {
  return useQuery({
    queryKey: ['admin', 'kpis'],
    queryFn: async () => {
      const { data } = await adminService.getKpis()
      return data
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
