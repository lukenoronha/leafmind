import { apiClient } from '@/lib/api-client'

export interface RagStatus {
  vectorStoreReady: boolean
  totalDocuments: number
  indexedDocuments: number
  failedDocuments: number
  totalChunks: number
  vectorCount: number
  embeddingModel: string
  collectionName: string
}

interface BackendRagStatusResponse {
  vector_store_ready: boolean
  total_documents: number
  indexed_documents: number
  failed_documents: number
  total_chunks: number
  vector_count: number
  embedding_model: string
  collection_name: string
}

/**
 * Wraps GET /rag/status (backend/app/api/v1/endpoints/rag.py) — not role-gated,
 * so it's usable by any authenticated user, but no existing frontend surface
 * called it before the Dashboard's Knowledge Base section.
 */
export const ragService = {
  getStatus: async (): Promise<RagStatus> => {
    const { data } = await apiClient.get<BackendRagStatusResponse>('/rag/status')
    return {
      vectorStoreReady: data.vector_store_ready,
      totalDocuments: data.total_documents,
      indexedDocuments: data.indexed_documents,
      failedDocuments: data.failed_documents,
      totalChunks: data.total_chunks,
      vectorCount: data.vector_count,
      embeddingModel: data.embedding_model,
      collectionName: data.collection_name,
    }
  },
}
