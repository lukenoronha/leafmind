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

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export interface AnalysisSession {
  id: string
  image: UploadedImage
  prediction: Prediction
  createdAt: string
  saved: boolean
}
