import { useCallback, useEffect, useRef, useState } from 'react'
import { analysisService } from '@/services/analysis.service'
import { chatStorage } from '@/lib/chat-storage'
import { getApiErrorMessage } from '@/lib/api-error'
import type { ChatMessage, RetrievalStage, Source } from '@/types/analysis'

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
 * Drives the RAG chat panel beneath a prediction. Streams each response
 * from /predict/chat/stream, surfacing retrieval stage, sources, and
 * response confidence as they arrive, and persists the conversation to
 * localStorage per prediction ID so it survives navigation/refresh.
 *
 * Retrieval itself happens entirely server-side — this hook only
 * consumes and renders the events the backend emits.
 */
export function useAnalysisChat(predictionId: string, plantName?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    chatStorage.load(predictionId),
  )
  const [stage, setStage] = useState<RetrievalStage | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reset when the underlying prediction changes (new analysis), following
  // React's "adjust state during render" pattern instead of an effect —
  // this avoids the extra render an effect-based reset would cause.
  const [loadedForId, setLoadedForId] = useState(predictionId)
  if (predictionId !== loadedForId) {
    setLoadedForId(predictionId)
    setMessages(chatStorage.load(predictionId))
    setStage(null)
  }

  useEffect(() => {
    chatStorage.save(predictionId, messages, plantName)
  }, [predictionId, messages, plantName])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || !predictionId) return

      setMessages((prev) => [...prev, createMessage('user', trimmed)])

      const assistantMessageId = crypto.randomUUID()
      let assistantContent = ''
      let sources: Source[] | undefined
      let responseConfidence: number | undefined

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          isStreaming: true,
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller
      setStage('searching')

      try {
        for await (const event of analysisService.streamChatMessage(
          { predictionId, message: trimmed },
          controller.signal,
        )) {
          switch (event.type) {
            case 'status':
              setStage(event.stage)
              break
            case 'sources':
              sources = event.sources
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, sources }
                    : message,
                ),
              )
              break
            case 'token':
              assistantContent += event.content
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, content: assistantContent }
                    : message,
                ),
              )
              break
            case 'done':
              responseConfidence = event.responseConfidence
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        responseConfidence,
                        isStreaming: false,
                        createdAt: event.createdAt,
                      }
                    : message,
                ),
              )
              setStage('done')
              break
            case 'error':
              throw new Error(event.message)
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: getApiErrorMessage(
                    error,
                    'Unable to reach the assistant right now.',
                  ),
                  isStreaming: false,
                }
              : message,
          ),
        )
        setStage('error')
      } finally {
        abortRef.current = null
      }
    },
    [predictionId],
  )

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const isSending = stage !== null && stage !== 'done' && stage !== 'error'

  return {
    messages,
    sendMessage,
    isSending,
    stage,
  }
}
