import type { Source } from '@/types/analysis'

/** Sourced from GET /developer/analytics — real aggregate counts/averages,
 * not a bespoke "KPI" endpoint (the backend has none). */
export interface AnalyticsSummary {
  totalUploads: number
  predictionCount: number
  avgConfidence: number | null
  avgInferenceMs: number | null
  avgRetrievalMs: number | null
  indexedDocuments: number
  totalChunks: number
  vectorCount: number
}

/** Sourced from GET /developer/metrics/timings — average latency across all
 * persisted predictions/chat turns. Presented as static pipeline-stage
 * timing info, not live per-request progress (the backend has no
 * "pipeline in progress" concept to report). */
export interface AverageTimings {
  predictionCount: number
  avgPreprocessingMs: number | null
  avgPredictionInferenceMs: number | null
  chatTurnCount: number
  avgRetrievalMs: number | null
  avgChatInferenceMs: number | null
}

export interface PredictionAnalytics {
  id: string
  plantName: string
  confidence: number
  modelVersion: string
  predictedAt: string
}

export interface PromptInspectorEntry {
  chatMessageId: string
  conversationId: string
  question: string
  predictedPlant: string | null
  retrievedContext: Source[]
  generatedResponse: string
}

export type LogLevel = 'info' | 'warning' | 'error' | 'debug'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  module: string
  function: string
  line: number
}

export interface LogFilters {
  level?: LogLevel
  search?: string
  limit?: number
  offset?: number
}

/** Sourced from GET /developer/system-status. */
export interface SystemStatus {
  backendHealthy: boolean
  databaseHealthy: boolean
  chromadbHealthy: boolean
  vectorCount: number
  vlmModelLoaded: boolean
  embeddingModelLoaded: boolean
  gpuAvailable: boolean
  gpuDeviceCount: number
  gpuDeviceNames: string[]
  cpuPercent: number
  memoryTotalMb: number
  memoryUsedMb: number
  memoryPercent: number
  diskTotalGb: number
  diskUsedGb: number
  diskPercent: number
}
