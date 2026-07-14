import { useCallback, useState } from 'react'
import { chatStorage, type ChatConversationMeta } from '@/lib/chat-storage'

/**
 * Client-side chat history — reads the localStorage conversation index
 * built up by useAnalysisChat. There is no backend chat history
 * endpoint; conversations only ever lived in the browser (see
 * chat-storage.ts), so this hook just wraps that storage with React
 * state so the history page re-renders after a delete.
 */
export function useChatHistory() {
  const [conversations, setConversations] = useState<ChatConversationMeta[]>(
    () => chatStorage.listConversations(),
  )

  const refresh = useCallback(() => {
    setConversations(chatStorage.listConversations())
  }, [])

  const deleteConversation = useCallback((predictionId: string) => {
    chatStorage.clear(predictionId)
    setConversations(chatStorage.listConversations())
  }, [])

  return { conversations, refresh, deleteConversation }
}
