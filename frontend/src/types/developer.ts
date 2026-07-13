import type { Source } from '@/types/analysis'

export type TrendDirection = 'up' | 'down' | 'flat'

export interface KpiMetric {
  id: string
  label: string
  value: string
  trend?: TrendDirection
  /** Change vs. the previous period, e.g. "+4.2%". */
  changeLabel?: string
}

export type PipelineStageStatus = 'pending' | 'running' | 'complete' | 'error'

export interface PipelineStage {
  id: string
  label: string
  status: PipelineStageStatus
  /** Duration in milliseconds, once complete. */
  durationMs?: number
}

export interface PredictionAnalytics {
  id: string
  plantName: string
  confidence: number
  /** End-to-end request latency, in milliseconds. */
  latencyMs: number
  /** Model inference time specifically, in milliseconds. */
  processingTimeMs: number
  modelVersion: string
  predictedAt: string
}

export interface RagAnalyticsSummary {
  avgRetrievedDocuments: number
  avgSimilarityScore: number
  avgRetrievalTimeMs: number
  embeddingModel: string
  vectorCount: number
}

export interface PromptInspectorEntry {
  id: string
  question: string
  predictedPlant: string
  retrievedContext: Source[]
  generatedResponse: string
  responseConfidence: number
  createdAt: string
}

export type LogLevel = 'info' | 'warning' | 'error' | 'debug'

export interface LogEntry {
  id: string
  level: LogLevel
  source: string
  message: string
  timestamp: string
}

export interface LogFilters {
  level?: LogLevel
  source?: string
  search?: string
}

export type SystemComponentStatus = 'operational' | 'degraded' | 'down'

export interface SystemComponentHealth {
  id: string
  name: string
  status: SystemComponentStatus
  /** e.g. response time, uptime percentage. */
  detail: string
  lastCheckedAt: string
}
