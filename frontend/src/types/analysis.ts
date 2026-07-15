export interface UploadedImage {
  id: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface PredictionCandidate {
  label: string
  confidence: number
  reasoning: string
}

export interface Prediction {
  id: string
  imageId: string
  plantName: string
  confidence: number
  candidates: PredictionCandidate[]
  modelVersion: string
  preprocessingMs: number
  inferenceMs: number
  predictedAt: string
}

/**
 * Grounded knowledge-base excerpt backing a prediction's "related knowledge"
 * section (see GET /reports/prediction/{id}). Deliberately not a fixed
 * medicinal-fact schema (family/native region/etc.) — the backend never
 * fabricates that content; it only surfaces real retrieved document
 * excerpts, or none at all if nothing relevant is indexed.
 */
export interface RelatedKnowledgeChunk {
  documentName: string
  pageNumber: number | null
  chapter: string | null
  score: number
  text: string
}

export interface PredictionReport {
  predictionId: string
  disclaimer: string
  knowledgeAvailable: boolean
  relatedKnowledge: RelatedKnowledgeChunk[]
}

export type ChatRole = 'user' | 'assistant'

export interface Source {
  chunkId: string
  documentId: string
  documentName: string
  pageNumber: number | null
  chapter: string | null
  score: number
  text: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  /** Retrieved documents backing this assistant message, if any. */
  sources?: Source[]
  /** True while a request for this message is in flight (no token streaming — the
   * backend returns the full answer in one response). */
  isPending?: boolean
}

export interface HistoryItem {
  predictionId: string
  imageId: string
  originalFilename: string
  predictedLabel: string
  confidence: number
  modelVersion: string
  createdAt: string
}

/**
 * One row in History/Saved Reports. `saved` reflects the backend's
 * `predictions.is_saved` flag (`GET /history` / `GET /history?saved=true`).
 * There is no UI control yet to actually set it — see
 * `PATCH /predictions/{id}/save` — so it will read `false` for every
 * existing prediction until a save action is added to the UI.
 * `image` has no URL — the backend has no endpoint that serves uploaded
 * image bytes back by ID, only a `GET /history` metadata listing.
 */
export interface AnalysisSession {
  id: string
  image: { id: string; originalFilename: string }
  prediction: {
    id: string
    plantName: string
    confidence: number
  }
  createdAt: string
  saved: boolean
}
