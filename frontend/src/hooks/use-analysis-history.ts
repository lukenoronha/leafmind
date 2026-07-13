import { useQuery } from '@tanstack/react-query'
import { analysisService } from '@/services/analysis.service'

export function useAnalysisHistory() {
  return useQuery({
    queryKey: ['analysis', 'history'],
    queryFn: async () => {
      const { data } = await analysisService.getHistory()
      return data
    },
  })
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['analysis', 'saved-reports'],
    queryFn: async () => {
      const { data } = await analysisService.getSavedReports()
      return data
    },
  })
}
