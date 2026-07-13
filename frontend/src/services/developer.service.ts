import { apiClient } from '@/lib/api-client'
import type {
  KpiMetric,
  LogEntry,
  LogFilters,
  PipelineStage,
  PredictionAnalytics,
  PromptInspectorEntry,
  RagAnalyticsSummary,
  SystemComponentHealth,
} from '@/types/developer'

/**
 * Developer dashboard service mirroring the FastAPI observability
 * endpoints. Placeholder — these calls will fail until the backend
 * exposes them. Purely read-only: this surface is for explainability
 * and research transparency, not administrative management.
 */
export const developerService = {
  getKpis: () => apiClient.get<KpiMetric[]>('/developer/kpis'),

  getPipelineStages: () =>
    apiClient.get<PipelineStage[]>('/developer/pipeline'),

  getPredictionAnalytics: () =>
    apiClient.get<PredictionAnalytics[]>('/developer/predictions/analytics'),

  getRagAnalytics: () =>
    apiClient.get<RagAnalyticsSummary>('/developer/rag/analytics'),

  getPromptInspectorEntries: () =>
    apiClient.get<PromptInspectorEntry[]>('/developer/prompts'),

  getLogs: (filters?: LogFilters) =>
    apiClient.get<LogEntry[]>('/developer/logs', { params: filters }),

  getSystemStatus: () =>
    apiClient.get<SystemComponentHealth[]>('/developer/system/status'),
}
