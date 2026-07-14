import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'

const EMBEDDINGS_QUERY_KEY = ['admin', 'embeddings', 'stats'] as const

export function useEmbeddingStats() {
  return useQuery({
    queryKey: EMBEDDINGS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await adminService.getEmbeddingStats()
      return data
    },
  })
}

export function useRebuildEmbeddings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => adminService.rebuildEmbeddings(),
    onSuccess: () => {
      toast.success('Embedding rebuild started.')
      void queryClient.invalidateQueries({ queryKey: EMBEDDINGS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to rebuild embeddings.'))
    },
  })
}
