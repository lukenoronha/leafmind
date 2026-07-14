import type { UserRole } from '@/types/auth'

export type AccountStatus = 'active' | 'inactive'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: AccountStatus
  joinedAt: string
}

export interface UserFilters {
  role?: UserRole
  status?: AccountStatus
}

/** One dataset "class" (species) in the medicinal-leaf image classifier's
 * training data — the real backend has no separate "dataset" concept
 * beyond this per-class folder of labeled images. */
export interface DatasetClass {
  classId: number
  trainingLabel: string | null
  folderName: string
  status: string
  displayName: string
  isVerified: boolean
}

export interface DatasetStatistics {
  totalClasses: number
  verifiedClasses: number
  rawDirExists: boolean
  rawDir: string
}

export type DocumentIndexStatus = 'indexed' | 'processing' | 'failed'

export interface KnowledgeDocument {
  id: string
  fileName: string
  sizeBytes: number
  indexStatus: DocumentIndexStatus
  statusMessage: string | null
  pageCount: number | null
  chunkCount: number
  uploadedAt: string
}

export interface EmbeddingStats {
  collectionName: string
  vectorCount: number
  persistDir: string
  distanceMetric: string
}

export interface AppSetting {
  key: string
  description: string
  value: string | number | boolean
  defaultValue: string | number | boolean
  isOverridden: boolean
  updatedBy: string | null
  updatedAt: string | null
}

export interface ActivityLogEntry {
  id: string
  actorEmail: string
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export interface ActivityLogFilters {
  actorEmail?: string
  action?: string
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface AdminSystemStatus {
  backendHealthy: boolean
  uptimeSeconds: number
  databaseHealthy: boolean
  chromadbHealthy: boolean
  vlmModelLoaded: boolean
  embeddingModelLoaded: boolean
  cpuPercent: number
  memoryTotalMb: number
  memoryUsedMb: number
  memoryPercent: number
  diskTotalGb: number
  diskUsedGb: number
  diskPercent: number
  avgRequestLatencyMs: number
  p95RequestLatencyMs: number
}
