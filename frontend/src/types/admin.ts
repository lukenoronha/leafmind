import type { UserRole } from '@/types/auth'
import type { SystemComponentStatus } from '@/types/developer'

export type AccountStatus = 'active' | 'inactive'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: AccountStatus
  avatarUrl?: string
  joinedAt: string
  lastActiveAt: string
  analysisCount: number
}

export interface UserFilters {
  search?: string
  role?: UserRole
  status?: AccountStatus
}

export type DatasetStatus = 'ready' | 'processing' | 'error'

export interface Dataset {
  id: string
  name: string
  description: string
  status: DatasetStatus
  imageCount: number
  classCount: number
  sizeBytes: number
  version: string
  updatedAt: string
}

export type DocumentIndexStatus = 'indexed' | 'indexing' | 'failed' | 'queued'

export interface KnowledgeDocument {
  id: string
  title: string
  fileName: string
  sizeBytes: number
  pageCount: number
  indexStatus: DocumentIndexStatus
  chunkCount: number
  uploadedAt: string
  uploadedBy: string
  previewUrl: string
}

export interface EmbeddingStats {
  collectionName: string
  embeddingModel: string
  vectorCount: number
  dimensions: number
  storageUsedBytes: number
  lastRebuiltAt: string
}

export type SettingFieldType = 'text' | 'number' | 'boolean' | 'select'

export interface AppSettingOption {
  label: string
  value: string
}

export interface AppSetting {
  key: string
  label: string
  description: string
  type: SettingFieldType
  value: string | number | boolean
  options?: AppSettingOption[]
  category: string
}

export interface ActivityLogEntry {
  id: string
  actor: string
  action: string
  target: string
  details: string
  timestamp: string
}

export interface ActivityLogFilters {
  search?: string
  action?: string
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminSystemComponent {
  id: string
  name: string
  status: SystemComponentStatus
  detail: string
  lastCheckedAt: string
}
