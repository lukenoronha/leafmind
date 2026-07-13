import type { AxiosProgressEvent } from 'axios'
import { apiClient } from '@/lib/api-client'
import { streamChat, type ChatStreamEvent } from '@/lib/stream-client'
import type {
  AnalysisSession,
  ChatMessage,
  HealthReport,
  Prediction,
  UploadedImage,
} from '@/types/analysis'

export interface UploadOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export interface PredictPayload {
  imageId: string
}

export interface ChatPayload {
  predictionId: string
  message: string
}

/**
 * Analysis service mirroring the FastAPI vision + RAG endpoints. The
 * backend is a placeholder — these calls will fail until /upload,
 * /predict, /history, and the RAG chat endpoints exist server-side.
 */
export const analysisService = {
  uploadImage: (file: File, options?: UploadOptions) => {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient.post<UploadedImage>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options?.signal,
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!options?.onProgress || !event.total) return
        options.onProgress(Math.round((event.loaded / event.total) * 100))
      },
    })
  },

  predict: (payload: PredictPayload) =>
    apiClient.post<{ prediction: Prediction; report: HealthReport }>(
      '/predict',
      payload,
    ),

  getHistory: () => apiClient.get<AnalysisSession[]>('/history'),

  getSavedReports: () =>
    apiClient.get<AnalysisSession[]>('/history', {
      params: { saved: true },
    }),

  saveReport: (predictionId: string) =>
    apiClient.post<void>(`/history/${predictionId}/save`),

  /** Non-streaming chat, kept as a fallback if streaming is unavailable. */
  sendChatMessage: (payload: ChatPayload) =>
    apiClient.post<ChatMessage>('/predict/chat', payload),

  /**
   * Streams the RAG pipeline's progress and generated response as
   * NDJSON events: retrieval status, retrieved sources, response
   * tokens, then a final `done` event with the response confidence.
   */
  streamChatMessage: (
    payload: ChatPayload,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> =>
    streamChat('/predict/chat/stream', payload, signal),

  getFollowUpQuestions: (predictionId: string) =>
    apiClient.get<string[]>(`/predict/${predictionId}/follow-ups`),
}
