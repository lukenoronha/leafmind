import type { AxiosProgressEvent } from 'axios'
import { apiClient } from '@/lib/api-client'
import type {
  AnalysisSession,
  ChatMessage,
  HistoryItem,
  Prediction,
  PredictionReport,
  Source,
  UploadedImage,
} from '@/types/analysis'

export interface UploadOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export interface PredictPayload {
  imageId: string
  topK?: number
}

export interface ChatPayload {
  predictionId: string
  imageId?: string
  message: string
  conversationId?: string
}

// --- Backend schemas (snake_case) — see backend/app/schemas/images.py, rag.py ---

interface BackendUploadResponse {
  image_id: string
  original_filename: string
  content_type: string
  size_bytes: number
  created_at: string
}

interface BackendCandidate {
  label: string
  confidence: number
  reasoning: string
}

interface BackendPredictResponse {
  prediction_id: string
  image_id: string
  predicted_label: string
  confidence: number
  candidates: BackendCandidate[]
  model_name: string
  preprocessing_ms: number
  inference_ms: number
  created_at: string
}

interface BackendHistoryItem {
  prediction_id: string
  image_id: string
  original_filename: string
  predicted_label: string
  confidence: number
  model_name: string
  created_at: string
}

interface BackendHistoryResponse {
  items: BackendHistoryItem[]
  total: number
  limit: number
  offset: number
}

interface BackendRetrievedChunk {
  chunk_id: string
  document_id: string
  document_name: string
  page_number: number | null
  chapter: string | null
  score: number
  text: string
}

interface BackendRagQueryResponse {
  conversation_id: string
  message: { id: string; role: string; content: string; created_at: string }
  model_name: string
  inference_ms: number
  retrieval: {
    retrieval_ms: number
    top_k: number
    similarity_threshold: number
    retrieved_chunks: BackendRetrievedChunk[]
  }
}

interface BackendRelatedKnowledgeChunk {
  document_name: string
  page_number: number | null
  chapter: string | null
  score: number
  text: string
}

interface BackendPredictionReportResponse {
  prediction_id: string
  disclaimer: string
  knowledge_available: boolean
  related_knowledge: BackendRelatedKnowledgeChunk[]
}

function toUploadedImage(data: BackendUploadResponse): UploadedImage {
  return {
    id: data.image_id,
    originalFilename: data.original_filename,
    contentType: data.content_type,
    sizeBytes: data.size_bytes,
    createdAt: data.created_at,
  }
}

function toPrediction(data: BackendPredictResponse): Prediction {
  return {
    id: data.prediction_id,
    imageId: data.image_id,
    plantName: data.predicted_label,
    confidence: data.confidence,
    candidates: data.candidates.map((c) => ({
      label: c.label,
      confidence: c.confidence,
      reasoning: c.reasoning,
    })),
    modelVersion: data.model_name,
    preprocessingMs: data.preprocessing_ms,
    inferenceMs: data.inference_ms,
    predictedAt: data.created_at,
  }
}

function toHistoryItem(data: BackendHistoryItem): HistoryItem {
  return {
    predictionId: data.prediction_id,
    imageId: data.image_id,
    originalFilename: data.original_filename,
    predictedLabel: data.predicted_label,
    confidence: data.confidence,
    modelVersion: data.model_name,
    createdAt: data.created_at,
  }
}

function toAnalysisSession(data: BackendHistoryItem): AnalysisSession {
  return {
    id: data.prediction_id,
    image: { id: data.image_id, originalFilename: data.original_filename },
    prediction: {
      id: data.prediction_id,
      plantName: data.predicted_label,
      confidence: data.confidence,
    },
    createdAt: data.created_at,
    // Always false — the backend has no "save a report" concept (no flag,
    // no endpoint). See the `saved` field's doc comment in types/analysis.ts.
    saved: false,
  }
}

function toSource(chunk: BackendRetrievedChunk): Source {
  return {
    chunkId: chunk.chunk_id,
    documentId: chunk.document_id,
    documentName: chunk.document_name,
    pageNumber: chunk.page_number,
    chapter: chunk.chapter,
    score: chunk.score,
    text: chunk.text,
  }
}

/**
 * Analysis service — wraps the real backend image analysis (Sprint 3) and
 * RAG chat (Sprint 4) endpoints, translating their snake_case Pydantic
 * response shapes into the frontend's camelCase types (mirroring the
 * translation layer in auth.service.ts).
 */
export const analysisService = {
  uploadImage: async (file: File, options?: UploadOptions) => {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post<BackendUploadResponse>(
      '/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: options?.signal,
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!options?.onProgress || !event.total) return
          options.onProgress(Math.round((event.loaded / event.total) * 100))
        },
      },
    )
    return toUploadedImage(data)
  },

  predict: async (payload: PredictPayload): Promise<Prediction> => {
    const { data } = await apiClient.post<BackendPredictResponse>('/predict', {
      image_id: payload.imageId,
      top_k: payload.topK ?? 3,
    })
    return toPrediction(data)
  },

  getHistoryItems: async (limit = 20, offset = 0): Promise<HistoryItem[]> => {
    const { data } = await apiClient.get<BackendHistoryResponse>('/history', {
      params: { limit, offset },
    })
    return data.items.map(toHistoryItem)
  },

  getHistory: async (): Promise<AnalysisSession[]> => {
    const { data } = await apiClient.get<BackendHistoryResponse>('/history')
    return data.items.map(toAnalysisSession)
  },

  /**
   * The backend has no "saved reports" concept (no flag on predictions, no
   * save/list-saved endpoint) — this returns an empty list rather than
   * silently reusing full history, so the Saved Reports page's empty state
   * is accurate instead of misleading. Restore this once a real backend
   * feature exists.
   */
  getSavedReports: async (): Promise<AnalysisSession[]> => {
    return []
  },

  /**
   * Grounded chat/query. The real backend has no token-by-token streaming —
   * one request returns the complete answer plus retrieved sources.
   */
  sendChatMessage: async (payload: ChatPayload): Promise<ChatMessage> => {
    const { data } = await apiClient.post<BackendRagQueryResponse>(
      '/rag/query',
      {
        message: payload.message,
        image_id: payload.imageId,
        conversation_id: payload.conversationId,
      },
    )
    return {
      id: data.message.id,
      role: data.message.role === 'assistant' ? 'assistant' : 'user',
      content: data.message.content,
      createdAt: data.message.created_at,
      sources: data.retrieval.retrieved_chunks.map(toSource),
    }
  },

  /** Related knowledge-base excerpts + disclaimer for a prediction's report. */
  getPredictionReport: async (
    predictionId: string,
  ): Promise<PredictionReport> => {
    const { data } = await apiClient.get<BackendPredictionReportResponse>(
      `/reports/prediction/${predictionId}`,
      { params: { format: 'json' } },
    )
    return {
      predictionId: data.prediction_id,
      disclaimer: data.disclaimer,
      knowledgeAvailable: data.knowledge_available,
      relatedKnowledge: data.related_knowledge.map((chunk) => ({
        documentName: chunk.document_name,
        pageNumber: chunk.page_number,
        chapter: chunk.chapter,
        score: chunk.score,
        text: chunk.text,
      })),
    }
  },
}
