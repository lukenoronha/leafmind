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

/**
 * Outcome of the backend's confidence-validation gate (Input Validation
 * Layer — see backend/app/models/prediction.py PredictionStatus). Kept as a
 * union of the two real backend values plus a catch-all `string` so an
 * unrecognized future value still type-checks instead of breaking callers;
 * anything other than 'low_confidence' is treated as the confident case.
 */
export type PredictionStatus = 'confident' | 'low_confidence' | (string & {})

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
  /** Defaults to 'confident' — see PredictionStatus. */
  status: PredictionStatus
  /** Backend-provided explanation, set only when status is 'low_confidence'.
   * Always use this message as-is rather than inventing new wording. */
  message: string | null
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

/**
 * Full single-prediction detail (`GET /predictions/{id}`) — unlike a plain
 * `Prediction` (returned live from `/predict`), this also carries the
 * original image's filename and the saved flag, everything a reopened
 * History/Saved Reports session needs to render the same prediction card a
 * live session would.
 */
export interface PredictionDetail extends Prediction {
  originalFilename: string
  isSaved: boolean
}

/**
 * One row in History/Saved Reports. `saved` reflects the backend's
 * `predictions.is_saved` flag (`GET /history` / `GET /history?saved=true`),
 * settable via `analysisService.setSaved()` (`PATCH /predictions/{id}/save`).
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
    status: PredictionStatus
  }
  createdAt: string
  saved: boolean
}
