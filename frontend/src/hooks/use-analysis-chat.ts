import { useCallback, useEffect, useState } from 'react'
import { analysisService } from '@/services/analysis.service'
import { chatStorage } from '@/lib/chat-storage'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ChatMessage } from '@/types/analysis'

function createMessage(
  role: ChatMessage['role'],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

/**
 * Drives the RAG chat panel beneath a prediction. The backend's grounded
 * chat endpoint (POST /rag/query) returns the complete answer and its
 * retrieved sources in one response — there is no token-by-token stream —
 * so this hook is a simple request/response flow with a single "isSending"
 * loading state, rather than a staged retrieval pipeline. Conversation
 * history is persisted to localStorage per prediction ID so it survives
 * navigation/refresh.
 */
export function useAnalysisChat(predictionId: string, imageId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    chatStorage.load(predictionId),
  )
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()

  // Reset when the underlying prediction changes (new analysis), following
  // React's "adjust state during render" pattern instead of an effect —
  // this avoids the extra render an effect-based reset would cause.
  const [loadedForId, setLoadedForId] = useState(predictionId)
  if (predictionId !== loadedForId) {
    setLoadedForId(predictionId)
    setMessages(chatStorage.load(predictionId))
    setConversationId(undefined)
  }

  useEffect(() => {
    chatStorage.save(predictionId, messages)
  }, [predictionId, messages])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      // The message box stays enabled even before a prediction exists (a
      // user can type while identification is still running), so this is
      // a real, reachable case rather than a defensive check — surfaced
      // as an inline error bubble, matching how a failed API call reads
      // below, rather than silently dropping the message.
      if (!predictionId) {
        setMessages((prev) => [
          ...prev,
          createMessage('user', trimmed),
          createMessage(
            'assistant',
            'Upload and identify a leaf photo before starting a chat.',
          ),
        ])
        return
      }

      setMessages((prev) => [...prev, createMessage('user', trimmed)])
      setIsSending(true)

      try {
        const reply = await analysisService.sendChatMessage({
          predictionId,
          imageId,
          message: trimmed,
          conversationId,
        })
        setConversationId((prev) => prev)
        setMessages((prev) => [...prev, reply])
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          createMessage(
            'assistant',
            getApiErrorMessage(
              error,
              'Unable to reach the assistant right now.',
            ),
          ),
        ])
      } finally {
        setIsSending(false)
      }
    },
    [predictionId, imageId, conversationId],
  )

  return {
    messages,
    sendMessage,
    isSending,
  }
}
