import type { AxiosProgressEvent } from 'axios'
import { apiClient } from '@/lib/api-client'
import type { KpiMetric } from '@/types/developer'
import type {
  ActivityLogEntry,
  ActivityLogFilters,
  AdminSystemComponent,
  AdminUser,
  AppSetting,
  Dataset,
  EmbeddingStats,
  KnowledgeDocument,
  PaginatedResult,
  UserFilters,
} from '@/types/admin'

export interface UploadOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

function withUploadProgress(options?: UploadOptions) {
  return {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal: options?.signal,
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!options?.onProgress || !event.total) return
      options.onProgress(Math.round((event.loaded / event.total) * 100))
    },
  }
}

/**
 * Admin console service mirroring the FastAPI admin endpoints.
 * Placeholder — these calls will fail until the backend exposes them.
 * Unlike the developer dashboard, this surface performs real mutations
 * (activation, deletion, uploads, rebuilds) alongside read-only views.
 */
export const adminService = {
  getKpis: () => apiClient.get<KpiMetric[]>('/admin/kpis'),

  // Users
  getUsers: (filters?: UserFilters) =>
    apiClient.get<AdminUser[]>('/admin/users', { params: filters }),

  setUserStatus: (userId: string, status: 'active' | 'inactive') =>
    apiClient.patch<AdminUser>(`/admin/users/${userId}/status`, { status }),

  deleteUser: (userId: string) =>
    apiClient.delete<void>(`/admin/users/${userId}`),

  // Datasets
  getDatasets: () => apiClient.get<Dataset[]>('/admin/datasets'),

  uploadDataset: (file: File, name: string, options?: UploadOptions) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    return apiClient.post<Dataset>(
      '/admin/datasets',
      formData,
      withUploadProgress(options),
    )
  },

  replaceDataset: (datasetId: string, file: File, options?: UploadOptions) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.put<Dataset>(
      `/admin/datasets/${datasetId}`,
      formData,
      withUploadProgress(options),
    )
  },

  deleteDataset: (datasetId: string) =>
    apiClient.delete<void>(`/admin/datasets/${datasetId}`),

  // Knowledge base
  getKnowledgeDocuments: () =>
    apiClient.get<KnowledgeDocument[]>('/admin/knowledge/documents'),

  uploadKnowledgeDocument: (file: File, options?: UploadOptions) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<KnowledgeDocument>(
      '/admin/knowledge/documents',
      formData,
      withUploadProgress(options),
    )
  },

  deleteKnowledgeDocument: (documentId: string) =>
    apiClient.delete<void>(`/admin/knowledge/documents/${documentId}`),

  reindexKnowledgeDocument: (documentId: string) =>
    apiClient.post<KnowledgeDocument>(
      `/admin/knowledge/documents/${documentId}/reindex`,
    ),

  // Embeddings
  getEmbeddingStats: () =>
    apiClient.get<EmbeddingStats>('/admin/embeddings/stats'),

  rebuildEmbeddings: () =>
    apiClient.post<EmbeddingStats>('/admin/embeddings/rebuild'),

  // System
  getSystemStatus: () =>
    apiClient.get<AdminSystemComponent[]>('/admin/system/status'),

  // Settings
  getSettings: () => apiClient.get<AppSetting[]>('/admin/settings'),

  updateSetting: (key: string, value: AppSetting['value']) =>
    apiClient.patch<AppSetting>(`/admin/settings/${key}`, { value }),

  // Activity logs
  getActivityLogs: (filters: ActivityLogFilters) =>
    apiClient.get<PaginatedResult<ActivityLogEntry>>('/admin/activity-logs', {
      params: filters,
    }),

  exportActivityLogs: (
    filters: Omit<ActivityLogFilters, 'page' | 'pageSize'>,
  ) =>
    apiClient.get<Blob>('/admin/activity-logs/export', {
      params: filters,
      responseType: 'blob',
    }),
}
