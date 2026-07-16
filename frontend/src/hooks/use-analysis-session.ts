import { useQuery } from '@tanstack/react-query'
import { analysisService } from '@/services/analysis.service'

/** Fetches full detail for one past prediction (GET /predictions/{id}) —
 * powers reopening a History/Saved Reports entry as a full session view. */
export function usePredictionDetail(predictionId: string | undefined) {
  return useQuery({
    queryKey: ['analysis', 'prediction-detail', predictionId],
    queryFn: () => analysisService.getPrediction(predictionId!),
    enabled: !!predictionId,
  })
}
