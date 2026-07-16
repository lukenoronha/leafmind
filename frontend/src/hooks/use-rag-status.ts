import { useQuery } from '@tanstack/react-query'
import { ragService } from '@/services/rag.service'

export function useRagStatus() {
  return useQuery({
    queryKey: ['rag', 'status'],
    queryFn: () => ragService.getStatus(),
  })
}
