import { useQuery } from '@tanstack/react-query'
import { analysisService } from '@/services/analysis.service'

export function useAnalysisHistory() {
  return useQuery({
    queryKey: ['analysis', 'history'],
    queryFn: () => analysisService.getHistory(),
  })
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['analysis', 'saved-reports'],
    queryFn: () => analysisService.getSavedReports(),
  })
}
