import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Bookmarks/unbookmarks a prediction. Invalidates both History and Saved
 * Reports — toggling `saved` moves the row in and out of the latter and
 * changes the badge shown in the former. */
export function useSetSaved() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ predictionId, isSaved }: { predictionId: string; isSaved: boolean }) =>
      analysisService.setSaved(predictionId, isSaved),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analysis', 'history'] })
      void queryClient.invalidateQueries({ queryKey: ['analysis', 'saved-reports'] })
    },
  })
}

/** Permanently deletes a prediction. Same invalidation as useSetSaved —
 * a deleted prediction must disappear from both lists. */
export function useDeletePrediction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (predictionId: string) =>
      analysisService.deletePrediction(predictionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analysis', 'history'] })
      void queryClient.invalidateQueries({ queryKey: ['analysis', 'saved-reports'] })
    },
  })
}
