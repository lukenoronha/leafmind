import type { AxiosProgressEvent } from 'axios'
import { apiClient } from '@/lib/api-client'
import type {
  ActivityLogEntry,
  ActivityLogFilters,
  AdminSystemStatus,
  AdminUser,
  AppSetting,
  DatasetClass,
  DatasetStatistics,
  EmbeddingStats,
  KnowledgeDocument,
  PaginatedResult,
  UserFilters,
} from '@/types/admin'
import type { UserRole } from '@/types/auth'

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

// --- Backend schemas (snake_case) — see backend/app/schemas/admin.py, auth.py ---

interface BackendRole {
  id: string
  name: string
}

interface BackendUserResponse {
  id: string
  email: string
  full_name: string
  role: BackendRole
  is_active: boolean
  is_verified: boolean
  created_at: string
}

interface BackendAdminUserListResponse {
  items: BackendUserResponse[]
  total: number
  limit: number
  offset: number
}

interface BackendDatasetClassResponse {
  class_id: number
  training_label: string | null
  folder_name: string
  status: string
  display_name: string
  is_verified: boolean
}

interface BackendDatasetClassListResponse {
  items: BackendDatasetClassResponse[]
}

interface BackendDatasetStatisticsResponse {
  total_classes: number
  verified_classes: number
  raw_dir_exists: boolean
  raw_dir: string
}

interface BackendAdminDocumentResponse {
  document_id: string
  original_filename: string
  size_bytes: number
  status: string
  status_message: string | null
  page_count: number | null
  chunk_count: number
  created_at: string
}

interface BackendAdminDocumentListResponse {
  items: BackendAdminDocumentResponse[]
  total: number
  limit: number
  offset: number
}

interface BackendEmbeddingStatisticsResponse {
  name: string
  vector_count: number
  persist_dir: string
  distance_metric: string
}

interface BackendEmbeddingRebuildResponse {
  reindexed_documents: number
  vector_count: number
}

interface BackendAdminSettingResponse {
  key: string
  value: unknown
  default_value: unknown
  is_overridden: boolean
  description: string
  updated_by: string | null
  updated_at: string | null
}

interface BackendAdminSettingListResponse {
  items: BackendAdminSettingResponse[]
}

interface BackendChromaCollectionInfo {
  name: string | null
  vector_count: number
  persist_dir: string | null
  distance_metric: string | null
}

interface BackendAdminSystemStatusResponse {
  backend_healthy: boolean
  uptime_seconds: number
  database_healthy: boolean
  chromadb_healthy: boolean
  chromadb_collection: BackendChromaCollectionInfo
  vlm_model_loaded: boolean
  embedding_model_loaded: boolean
  cpu_percent: number
  memory_total_mb: number
  memory_used_mb: number
  memory_percent: number
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
  avg_request_latency_ms: number
  p95_request_latency_ms: number
}

interface BackendAdminActivityLogEntry {
  id: string
  actor_email: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

interface BackendAdminActivityLogListResponse {
  items: BackendAdminActivityLogEntry[]
  total: number
  limit: number
  offset: number
}

function toAdminUser(data: BackendUserResponse): AdminUser {
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    role: data.role.name as UserRole,
    status: data.is_active ? 'active' : 'inactive',
    joinedAt: data.created_at,
  }
}

function toDatasetClass(data: BackendDatasetClassResponse): DatasetClass {
  return {
    classId: data.class_id,
    trainingLabel: data.training_label,
    folderName: data.folder_name,
    status: data.status,
    displayName: data.display_name,
    isVerified: data.is_verified,
  }
}

function toKnowledgeDocument(data: BackendAdminDocumentResponse): KnowledgeDocument {
  return {
    id: data.document_id,
    fileName: data.original_filename,
    sizeBytes: data.size_bytes,
    indexStatus: data.status as KnowledgeDocument['indexStatus'],
    statusMessage: data.status_message,
    pageCount: data.page_count,
    chunkCount: data.chunk_count,
    uploadedAt: data.created_at,
  }
}

function toEmbeddingStats(data: BackendEmbeddingStatisticsResponse): EmbeddingStats {
  return {
    collectionName: data.name,
    vectorCount: data.vector_count,
    persistDir: data.persist_dir,
    distanceMetric: data.distance_metric,
  }
}

function toAppSetting(data: BackendAdminSettingResponse): AppSetting {
  return {
    key: data.key,
    description: data.description,
    value: data.value as AppSetting['value'],
    defaultValue: data.default_value as AppSetting['defaultValue'],
    isOverridden: data.is_overridden,
    updatedBy: data.updated_by,
    updatedAt: data.updated_at,
  }
}

function toAdminSystemStatus(data: BackendAdminSystemStatusResponse): AdminSystemStatus {
  return {
    backendHealthy: data.backend_healthy,
    uptimeSeconds: data.uptime_seconds,
    databaseHealthy: data.database_healthy,
    chromadbHealthy: data.chromadb_healthy,
    vlmModelLoaded: data.vlm_model_loaded,
    embeddingModelLoaded: data.embedding_model_loaded,
    cpuPercent: data.cpu_percent,
    memoryTotalMb: data.memory_total_mb,
    memoryUsedMb: data.memory_used_mb,
    memoryPercent: data.memory_percent,
    diskTotalGb: data.disk_total_gb,
    diskUsedGb: data.disk_used_gb,
    diskPercent: data.disk_percent,
    avgRequestLatencyMs: data.avg_request_latency_ms,
    p95RequestLatencyMs: data.p95_request_latency_ms,
  }
}

function toActivityLogEntry(data: BackendAdminActivityLogEntry): ActivityLogEntry {
  return {
    id: data.id,
    actorEmail: data.actor_email,
    action: data.action,
    targetType: data.target_type,
    targetId: data.target_id,
    details: data.details,
    createdAt: data.created_at,
  }
}

/**
 * Admin console service — wraps the real backend admin endpoints (Sprint 6,
 * prefix /admin/*). Performs real mutations (activation, deletion, uploads,
 * rebuilds) alongside read-only views, translating each endpoint's
 * snake_case Pydantic shape into the frontend's camelCase types.
 */
export const adminService = {
  // Users
  getUsers: async (filters?: UserFilters): Promise<AdminUser[]> => {
    const { data } = await apiClient.get<BackendAdminUserListResponse>(
      '/admin/users',
      {
        params: {
          role: filters?.role,
          is_active: filters?.status ? filters.status === 'active' : undefined,
        },
      },
    )
    return data.items.map(toAdminUser)
  },

  setUserStatus: async (userId: string, status: 'active' | 'inactive') => {
    const { data } = await apiClient.patch<BackendUserResponse>(
      `/admin/users/${userId}/active`,
      { is_active: status === 'active' },
    )
    return toAdminUser(data)
  },

  deleteUser: (userId: string) =>
    apiClient.delete<void>(`/admin/users/${userId}`),

  // Datasets (real backend concept: labeled image classes, not versioned
  // ML datasets with ZIP-archive replace)
  getDatasetStatistics: async (): Promise<DatasetStatistics> => {
    const { data } = await apiClient.get<BackendDatasetStatisticsResponse>(
      '/admin/datasets/statistics',
    )
    return {
      totalClasses: data.total_classes,
      verifiedClasses: data.verified_classes,
      rawDirExists: data.raw_dir_exists,
      rawDir: data.raw_dir,
    }
  },

  getDatasetClasses: async (): Promise<DatasetClass[]> => {
    const { data } = await apiClient.get<BackendDatasetClassListResponse>(
      '/admin/datasets',
    )
    return data.items.map(toDatasetClass)
  },

  uploadDatasetClass: async (
    trainingLabel: string,
    folderName: string,
    files: File[],
    replaceExisting: boolean,
    options?: UploadOptions,
  ): Promise<DatasetClass> => {
    const formData = new FormData()
    formData.append('training_label', trainingLabel)
    formData.append('folder_name', folderName)
    formData.append('replace_existing', String(replaceExisting))
    for (const file of files) formData.append('files', file)

    const { data } = await apiClient.post<BackendDatasetClassResponse>(
      '/admin/datasets/upload',
      formData,
      withUploadProgress(options),
    )
    return toDatasetClass(data)
  },

  deleteDatasetClass: (classId: number) =>
    apiClient.delete<void>(`/admin/datasets/${classId}`),

  // Knowledge base
  getKnowledgeDocuments: async (): Promise<KnowledgeDocument[]> => {
    const { data } = await apiClient.get<BackendAdminDocumentListResponse>(
      '/admin/knowledge-base/documents',
    )
    return data.items.map(toKnowledgeDocument)
  },

  uploadKnowledgeDocument: async (
    file: File,
    options?: UploadOptions,
  ): Promise<KnowledgeDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<BackendAdminDocumentResponse>(
      '/admin/knowledge-base/documents',
      formData,
      withUploadProgress(options),
    )
    return toKnowledgeDocument(data)
  },

  deleteKnowledgeDocument: (documentId: string) =>
    apiClient.delete<void>(`/admin/knowledge-base/documents/${documentId}`),

  reindexKnowledgeDocument: (documentId: string) =>
    apiClient.post<void>('/admin/knowledge-base/reindex', {
      document_id: documentId,
    }),

  // Embeddings
  getEmbeddingStats: async (): Promise<EmbeddingStats> => {
    const { data } = await apiClient.get<BackendEmbeddingStatisticsResponse>(
      '/admin/embeddings/statistics',
    )
    return toEmbeddingStats(data)
  },

  rebuildEmbeddings: async (): Promise<{ reindexedDocuments: number; vectorCount: number }> => {
    const { data } = await apiClient.post<BackendEmbeddingRebuildResponse>(
      '/admin/embeddings/rebuild',
    )
    return { reindexedDocuments: data.reindexed_documents, vectorCount: data.vector_count }
  },

  // System
  getSystemStatus: async (): Promise<AdminSystemStatus> => {
    const { data } = await apiClient.get<BackendAdminSystemStatusResponse>(
      '/admin/monitoring/status',
    )
    return toAdminSystemStatus(data)
  },

  // Settings — a fixed allow-list of keys (see AdminSettingsService backend
  // docstring), not a category-grouped/typed generic settings system.
  getSettings: async (): Promise<AppSetting[]> => {
    const { data } = await apiClient.get<BackendAdminSettingListResponse>(
      '/admin/settings',
    )
    return data.items.map(toAppSetting)
  },

  updateSetting: async (key: string, value: AppSetting['value']): Promise<AppSetting> => {
    const { data } = await apiClient.put<BackendAdminSettingResponse>(
      `/admin/settings/${key}`,
      { value: String(value) },
    )
    return toAppSetting(data)
  },

  resetSetting: async (key: string): Promise<AppSetting> => {
    const { data } = await apiClient.delete<BackendAdminSettingResponse>(
      `/admin/settings/${key}`,
    )
    return toAppSetting(data)
  },

  // Activity logs
  getActivityLogs: async (
    filters: ActivityLogFilters,
  ): Promise<PaginatedResult<ActivityLogEntry>> => {
    const { data } = await apiClient.get<BackendAdminActivityLogListResponse>(
      '/admin/activity-log',
      { params: filters },
    )
    return {
      items: data.items.map(toActivityLogEntry),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
    }
  },

  exportActivityLogs: (filters: Omit<ActivityLogFilters, 'limit' | 'offset'>) =>
    apiClient.get<Blob>('/admin/activity-log/export', {
      params: filters,
      responseType: 'blob',
    }),
}
