import type { ChatMessage } from '@/types/analysis'

const STORAGE_PREFIX = 'leafmind_chat_'

/**
 * Persists chat conversations to localStorage, keyed by prediction ID,
 * so a conversation survives navigation and page refresh. Mirrors
 * token-storage.ts's pattern of centralizing one storage concern.
 */
export const chatStorage = {
  load: (predictionId: string): ChatMessage[] => {
    if (!predictionId) return []
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + predictionId)
      return raw ? (JSON.parse(raw) as ChatMessage[]) : []
    } catch {
      return []
    }
  },

  save: (predictionId: string, messages: ChatMessage[]) => {
    if (!predictionId) return
    localStorage.setItem(
      STORAGE_PREFIX + predictionId,
      JSON.stringify(messages),
    )
  },

  clear: (predictionId: string) => {
    localStorage.removeItem(STORAGE_PREFIX + predictionId)
  },
}
