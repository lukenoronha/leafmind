import type { ChatMessage } from '@/types/analysis'

const STORAGE_PREFIX = 'leafmind_chat_'
const INDEX_KEY = 'leafmind_chat_index'

export interface ChatConversationMeta {
  predictionId: string
  plantName: string
  updatedAt: string
  messageCount: number
}

function readIndex(): ChatConversationMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as ChatConversationMeta[]) : []
  } catch {
    return []
  }
}

function writeIndex(entries: ChatConversationMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
}

/**
 * Persists chat conversations to localStorage, keyed by prediction ID,
 * so a conversation survives navigation and page refresh. An index
 * entry (plant name, message count, last updated) is kept alongside
 * each conversation so a history view can list them without needing
 * to load and parse every conversation's full message array.
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

  save: (predictionId: string, messages: ChatMessage[], plantName?: string) => {
    if (!predictionId) return
    localStorage.setItem(
      STORAGE_PREFIX + predictionId,
      JSON.stringify(messages),
    )

    if (messages.length === 0) return

    const index = readIndex()
    const existing = index.find((entry) => entry.predictionId === predictionId)
    const meta: ChatConversationMeta = {
      predictionId,
      plantName: plantName ?? existing?.plantName ?? 'Unknown plant',
      updatedAt: new Date().toISOString(),
      messageCount: messages.length,
    }
    writeIndex([
      meta,
      ...index.filter((entry) => entry.predictionId !== predictionId),
    ])
  },

  clear: (predictionId: string) => {
    localStorage.removeItem(STORAGE_PREFIX + predictionId)
    writeIndex(
      readIndex().filter((entry) => entry.predictionId !== predictionId),
    )
  },

  listConversations: (): ChatConversationMeta[] => {
    return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
}
