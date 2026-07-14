import { apiClient } from '@/lib/api-client'
import type {
  AnalyticsSummary,
  AverageTimings,
  LogEntry,
  LogFilters,
  PredictionAnalytics,
  PromptInspectorEntry,
  SystemStatus,
} from '@/types/developer'
import type { Source } from '@/types/analysis'

// --- Backend schemas (snake_case) — see backend/app/schemas/developer.py ---

interface BackendAnalyticsResponse {
  total_uploads: number
  prediction_count: number
  avg_confidence: number | null
  avg_inference_ms: number | null
  avg_retrieval_ms: number | null
  indexed_documents: number
  total_chunks: number
  vector_count: number
}

interface BackendAverageTimingsResponse {
  prediction_count: number
  avg_preprocessing_ms: number | null
  avg_prediction_inference_ms: number | null
  chat_turn_count: number
  avg_retrieval_ms: number | null
  avg_chat_inference_ms: number | null
}

interface BackendPredictionMetadata {
  prediction_id: string
  image_id: string
  plant_name: string
  scientific_name: string
  confidence: number
  model_version: string
  timestamp: string
  candidates: Record<string, unknown>[]
}

interface BackendPredictionMetadataListResponse {
  items: BackendPredictionMetadata[]
  total: number
  limit: number
  offset: number
}

interface BackendPromptInspectorContextExcerpt {
  document_name: string
  page_number: number | null
  chapter: string | null
  score: number
  excerpt: string
}

interface BackendPromptInspectorResponse {
  chat_message_id: string
  conversation_id: string
  user_question: string
  predicted_plant: string | null
  retrieved_context_excerpts: BackendPromptInspectorContextExcerpt[]
  prompt_template: string
  rendered_messages: { role: string; content: string }[]
  generated_response: string
}

interface BackendLogEntry {
  timestamp: string
  level: string
  message: string
  module: string
  function: string
  line: number
  extra: Record<string, unknown>
}

interface BackendLogListResponse {
  items: BackendLogEntry[]
  total: number
  limit: number
  offset: number
  query_ms: number
}

interface BackendSystemStatusResponse {
  backend_healthy: boolean
  database_healthy: boolean
  chromadb_healthy: boolean
  vector_count: number
  vlm_model_importable: boolean
  vlm_model_loaded: boolean
  embedding_model_importable: boolean
  embedding_model_loaded: boolean
  gpu_available: boolean
  gpu_device_count: number
  gpu_device_names: string[]
  cpu_percent: number
  memory_total_mb: number
  memory_used_mb: number
  memory_percent: number
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
}

function toAnalyticsSummary(data: BackendAnalyticsResponse): AnalyticsSummary {
  return {
    totalUploads: data.total_uploads,
    predictionCount: data.prediction_count,
    avgConfidence: data.avg_confidence,
    avgInferenceMs: data.avg_inference_ms,
    avgRetrievalMs: data.avg_retrieval_ms,
    indexedDocuments: data.indexed_documents,
    totalChunks: data.total_chunks,
    vectorCount: data.vector_count,
  }
}

function toAverageTimings(data: BackendAverageTimingsResponse): AverageTimings {
  return {
    predictionCount: data.prediction_count,
    avgPreprocessingMs: data.avg_preprocessing_ms,
    avgPredictionInferenceMs: data.avg_prediction_inference_ms,
    chatTurnCount: data.chat_turn_count,
    avgRetrievalMs: data.avg_retrieval_ms,
    avgChatInferenceMs: data.avg_chat_inference_ms,
  }
}

function toPredictionAnalytics(
  data: BackendPredictionMetadata,
): PredictionAnalytics {
  return {
    id: data.prediction_id,
    plantName: data.plant_name,
    confidence: data.confidence,
    modelVersion: data.model_version,
    predictedAt: data.timestamp,
  }
}

function toSource(chunk: BackendPromptInspectorContextExcerpt, index: number): Source {
  return {
    chunkId: `${chunk.document_name}-${index}`,
    documentId: chunk.document_name,
    documentName: chunk.document_name,
    pageNumber: chunk.page_number,
    chapter: chunk.chapter,
    score: chunk.score,
    text: chunk.excerpt,
  }
}

function toLogEntry(data: BackendLogEntry): LogEntry {
  return {
    timestamp: data.timestamp,
    level: (data.level.toLowerCase() as LogEntry['level']) ?? 'info',
    message: data.message,
    module: data.module,
    function: data.function,
    line: data.line,
  }
}

function toSystemStatus(data: BackendSystemStatusResponse): SystemStatus {
  return {
    backendHealthy: data.backend_healthy,
    databaseHealthy: data.database_healthy,
    chromadbHealthy: data.chromadb_healthy,
    vectorCount: data.vector_count,
    vlmModelLoaded: data.vlm_model_loaded,
    embeddingModelLoaded: data.embedding_model_loaded,
    gpuAvailable: data.gpu_available,
    gpuDeviceCount: data.gpu_device_count,
    gpuDeviceNames: data.gpu_device_names,
    cpuPercent: data.cpu_percent,
    memoryTotalMb: data.memory_total_mb,
    memoryUsedMb: data.memory_used_mb,
    memoryPercent: data.memory_percent,
    diskTotalGb: data.disk_total_gb,
    diskUsedGb: data.disk_used_gb,
    diskPercent: data.disk_percent,
  }
}

/**
 * Developer dashboard service — wraps the real backend observability
 * endpoints (Sprint 5, prefix /developer). Read-only. The backend has no
 * bulk "KPI"/"pipeline stage"/"prompt inspector list" endpoints — only
 * aggregate analytics/timings and per-entity (per-prediction,
 * per-chat-message) lookups — so callers here work off those real shapes
 * rather than a bespoke dashboard API.
 */
export const developerService = {
  getAnalyticsSummary: async (): Promise<AnalyticsSummary> => {
    const { data } = await apiClient.get<BackendAnalyticsResponse>(
      '/developer/analytics',
    )
    return toAnalyticsSummary(data)
  },

  getAverageTimings: async (): Promise<AverageTimings> => {
    const { data } = await apiClient.get<BackendAverageTimingsResponse>(
      '/developer/metrics/timings',
    )
    return toAverageTimings(data)
  },

  getPredictionAnalytics: async (
    limit = 20,
    offset = 0,
  ): Promise<PredictionAnalytics[]> => {
    const { data } = await apiClient.get<BackendPredictionMetadataListResponse>(
      '/developer/predictions',
      { params: { limit, offset } },
    )
    return data.items.map(toPredictionAnalytics)
  },

  /** Inspects one chat turn by ID — there is no bulk listing endpoint. */
  getPromptInspectorEntry: async (
    chatMessageId: string,
  ): Promise<PromptInspectorEntry> => {
    const { data } = await apiClient.get<BackendPromptInspectorResponse>(
      `/developer/chat-messages/${chatMessageId}/prompt-inspector`,
    )
    return {
      chatMessageId: data.chat_message_id,
      conversationId: data.conversation_id,
      question: data.user_question,
      predictedPlant: data.predicted_plant,
      retrievedContext: data.retrieved_context_excerpts.map(toSource),
      generatedResponse: data.generated_response,
    }
  },

  getLogs: async (filters?: LogFilters): Promise<LogEntry[]> => {
    const { data } = await apiClient.get<BackendLogListResponse>(
      '/developer/logs',
      {
        params: {
          level: filters?.level,
          search: filters?.search,
          limit: filters?.limit ?? 50,
          offset: filters?.offset ?? 0,
        },
      },
    )
    return data.items.map(toLogEntry)
  },

  getSystemStatus: async (): Promise<SystemStatus> => {
    const { data } = await apiClient.get<BackendSystemStatusResponse>(
      '/developer/system-status',
    )
    return toSystemStatus(data)
  },
}
