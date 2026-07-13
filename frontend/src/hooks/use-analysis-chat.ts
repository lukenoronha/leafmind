import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { analysisService } from '@/services/analysis.service'
import type { ChatMessage } from '@/types/analysis'
import { getApiErrorMessage } from '@/lib/api-error'

function createMessage(
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Drives the chat panel beneath a prediction. Sends each user message to
 * the placeholder /predict/chat endpoint and appends whatever comes
 * back — no RAG or retrieval yet, this just relays the model response.
 */
export function useAnalysisChat(predictionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const mutation = useMutation({
    mutationFn: (message: string) =>
      analysisService.sendChatMessage({ predictionId, message }),
  })

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      setMessages((prev) => [...prev, createMessage('user', trimmed)])

      try {
        const { data } = await mutation.mutateAsync(trimmed)
        setMessages((prev) => [
          ...prev,
          createMessage('assistant', data.content),
        ])
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
      }
    },
    [mutation],
  )

  return {
    messages,
    sendMessage,
    isSending: mutation.isPending,
  }
}
