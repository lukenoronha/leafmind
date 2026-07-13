import { useMutation } from '@tanstack/react-query'
import {
  analysisService,
  type PredictPayload,
} from '@/services/analysis.service'

export function usePredict() {
  const mutation = useMutation({
    mutationFn: (payload: PredictPayload) => analysisService.predict(payload),
  })

  return {
    predict: mutation.mutateAsync,
    isPredicting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
