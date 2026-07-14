import { useQueries } from '@tanstack/react-query'
import { adminService } from '@/services/admin.service'

const REFRESH_INTERVAL_MS = 30_000

/** No single backend endpoint provides admin dashboard KPIs — this
 * combines three real read endpoints (dataset stats, knowledge base
 * status via embeddings, system status) into one set of cards. */
export function useAdminKpis() {
  const results = useQueries({
    queries: [
      {
        queryKey: ['admin', 'kpis', 'dataset-stats'],
        queryFn: () => adminService.getDatasetStatistics(),
        refetchInterval: REFRESH_INTERVAL_MS,
      },
      {
        queryKey: ['admin', 'kpis', 'embedding-stats'],
        queryFn: () => adminService.getEmbeddingStats(),
        refetchInterval: REFRESH_INTERVAL_MS,
      },
      {
        queryKey: ['admin', 'kpis', 'knowledge-documents'],
        queryFn: () => adminService.getKnowledgeDocuments(),
        refetchInterval: REFRESH_INTERVAL_MS,
      },
    ],
  })

  const [datasetStats, embeddingStats, documents] = results
  const isLoading = results.some((r) => r.isLoading)
  const isError = results.some((r) => r.isError)

  const metrics =
    !isLoading && !isError && datasetStats.data && embeddingStats.data && documents.data
      ? [
          {
            id: 'dataset-classes',
            label: 'Dataset classes',
            value: datasetStats.data.totalClasses.toLocaleString(),
          },
          {
            id: 'kb-documents',
            label: 'Knowledge base documents',
            value: documents.data.length.toLocaleString(),
          },
          {
            id: 'vector-count',
            label: 'Vector count',
            value: embeddingStats.data.vectorCount.toLocaleString(),
          },
        ]
      : undefined

  return {
    data: metrics,
    isLoading,
    isError,
    refetch: () => results.forEach((r) => void r.refetch()),
  }
}
