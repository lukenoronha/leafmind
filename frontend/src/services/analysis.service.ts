import type { AxiosProgressEvent } from 'axios'
import { apiClient } from '@/lib/api-client'
import type {
  AnalysisSession,
  ChatMessage,
  HistoryItem,
  Prediction,
  PredictionReport,
  PredictionStatus,
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

/**
 * Return shape of sendChatMessage — bundles the assistant's reply with the
 * backend's conversation_id (see RAGQueryResponse.conversation_id) so the
 * caller can persist it and pass it back on the next turn. Kept separate
 * from ChatMessage itself (rather than adding conversationId to that type)
 * since ChatMessage is also used as a plain stored/exported record
 * (chat-storage.ts, chat-export.ts) that has no reason to know about
 * conversation IDs.
 */
export interface ChatSendResult {
  message: ChatMessage
  conversationId: string
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
  // Additive (Input Validation Layer) — see backend/app/schemas/images.py.
  // Optional here since older cached/mocked responses may not include them;
  // toPrediction() below defaults status to 'confident' when absent.
  status?: PredictionStatus
  message?: string | null
}

interface BackendHistoryItem {
  prediction_id: string
  image_id: string
  original_filename: string
  predicted_label: string
  confidence: number
  model_name: string
  is_saved: boolean
  created_at: string
  status?: PredictionStatus
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

interface BackendPersistedSource {
  chunk_id: string
  document_id: string
  document_name: string
  page_number: number | null
  chapter: string | null
  score: number
}

interface BackendConversationMessage {
  id: string
  role: string
  content: string
  created_at: string
  sources: BackendPersistedSource[]
}

interface BackendConversationResponse {
  prediction_id: string
  messages: BackendConversationMessage[]
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
    status: data.status ?? 'confident',
    message: data.message ?? null,
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
      status: data.status ?? 'confident',
    },
    createdAt: data.created_at,
    saved: data.is_saved,
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
    // VLM inference can take several minutes on CPU-only deployments (no
    // GPU) — observed up to ~6 min including a cold model load, so this
    // needs real headroom above that, matching nginx's proxy_read_timeout.
    const { data } = await apiClient.post<BackendPredictResponse>(
      '/predict',
      { image_id: payload.imageId, top_k: payload.topK ?? 3 },
      { timeout: 600_000 },
    )
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

  getSavedReports: async (): Promise<AnalysisSession[]> => {
    const { data } = await apiClient.get<BackendHistoryResponse>('/history', {
      params: { saved: true },
    })
    return data.items.map(toAnalysisSession)
  },

  /** Bookmarks or unbookmarks a prediction (PATCH /predictions/{id}/save). */
  setSaved: async (predictionId: string, isSaved: boolean): Promise<AnalysisSession> => {
    const { data } = await apiClient.patch<BackendHistoryItem>(
      `/predictions/${predictionId}/save`,
      { is_saved: isSaved },
    )
    return toAnalysisSession(data)
  },

  /** Permanently removes a prediction from History/Saved Reports. */
  deletePrediction: async (predictionId: string): Promise<void> => {
    await apiClient.delete(`/predictions/${predictionId}`)
  },

  /**
   * Grounded chat/query. The real backend has no token-by-token streaming —
   * one request returns the complete answer plus retrieved sources. Also
   * returns the backend's conversation_id (RAGQueryResponse.conversation_id)
   * so the caller can persist it and reuse it on the next turn — omitting
   * conversation_id on a follow-up request makes the backend start a brand
   * new conversation, losing multi-turn context server-side even though the
   * UI still looks continuous (it replays history from localStorage).
   */
  sendChatMessage: async (payload: ChatPayload): Promise<ChatSendResult> => {
    // Same rationale as predict() above — RAG generation runs the same
    // CPU-bound VLM and can take several minutes without a GPU.
    const { data } = await apiClient.post<BackendRagQueryResponse>(
      '/rag/query',
      {
        message: payload.message,
        image_id: payload.imageId,
        conversation_id: payload.conversationId,
      },
      { timeout: 600_000 },
    )
    return {
      message: {
        id: data.message.id,
        role: data.message.role === 'assistant' ? 'assistant' : 'user',
        content: data.message.content,
        createdAt: data.message.created_at,
        sources: data.retrieval.retrieved_chunks.map(toSource),
      },
      conversationId: data.conversation_id,
    }
  },

  /**
   * Reopens a conversation by prediction ID from the server, for a browser
   * whose localStorage copy (see chat-storage.ts) was cleared or never
   * existed. Only turns sent after the backend started recording
   * prediction_id are linkable this way — older conversations return an
   * empty array rather than an error. Not called by any component yet;
   * ready for whenever Chat History grows a "reopen from server" fallback.
   *
   * Note: unlike sendChatMessage's live sources, the backend only persists
   * chunk/document identity + score for a past turn, not the retrieved
   * text itself — `source.text` is always `''` here. A citation-jump UI
   * that relies on the excerpt text (e.g. SourcesPanel) would need that
   * backfilled server-side before this is wired into a real component.
   */
  getConversation: async (predictionId: string): Promise<ChatMessage[]> => {
    const { data } = await apiClient.get<BackendConversationResponse>(
      `/rag/conversations/${predictionId}`,
    )
    return data.messages.map((message) => ({
      id: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      createdAt: message.created_at,
      sources: message.sources.map((source) => ({
        chunkId: source.chunk_id,
        documentId: source.document_id,
        documentName: source.document_name,
        pageNumber: source.page_number,
        chapter: source.chapter,
        score: source.score,
        text: '',
      })),
    }))
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

  /** Server-generated PDF for a prediction's report (reportlab, backend-rendered — no client-side PDF generation). */
  getPredictionReportPdf: async (predictionId: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/reports/prediction/${predictionId}`,
      { params: { format: 'pdf' }, responseType: 'blob' },
    )
    return data
  },
}
