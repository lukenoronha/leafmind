export interface UploadedImage {
  id: string
  url: string
}

export interface Prediction {
  id: string
  imageId: string
  plantName: string
  scientificName: string
  confidence: number
  modelVersion: string
  predictedAt: string
}

export interface HealthReport {
  predictionId: string
  summary: string
  family: string
  nativeRegion: string
  medicinalUses: string[]
  activeCompounds: string[]
  toxicityNotes: string
  growthHabit: string
}

export type ChatRole = 'user' | 'assistant'

/**
 * Stages of the RAG pipeline, surfaced to the user while an assistant
 * response is being generated.
 */
export type RetrievalStage =
  'searching' | 'retrieved' | 'generating' | 'done' | 'error'

export interface Source {
  id: string
  documentTitle: string
  chapter: string
  pageNumber: number
  retrievalConfidence: number
  excerpt?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  /** Retrieved documents backing this assistant message, if any. */
  sources?: Source[]
  /** Model's confidence in the generated response, 0-1. */
  responseConfidence?: number
  /** True while an assistant message is still receiving streamed tokens. */
  isStreaming?: boolean
}

export interface AnalysisSession {
  id: string
  image: UploadedImage
  prediction: Prediction
  createdAt: string
  saved: boolean
}
