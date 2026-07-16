import { useCallback, useEffect, useRef, useState } from 'react'
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
 *
 * When localStorage has nothing for this prediction (a fresh browser, a
 * cleared cache, or a session reopened from History/Saved Reports on a
 * different device), this hook falls back to fetching the persisted
 * conversation from the server (GET /rag/conversations/{id}) — including
 * the conversation_id those turns share, so a follow-up message correctly
 * continues the same thread instead of starting a new one.
 */
export function useAnalysisChat(predictionId: string, imageId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    chatStorage.load(predictionId),
  )
  const [isSending, setIsSending] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  // Tracks whether the "no prediction yet" notice has already been shown
  // for the current (missing) prediction, so repeated Send presses append
  // it once instead of spamming the feed with the same assistant message.
  const [noPredictionNoticeShown, setNoPredictionNoticeShown] = useState(false)

  // Reset when the underlying prediction changes (new analysis), following
  // React's "adjust state during render" pattern instead of an effect —
  // this avoids the extra render an effect-based reset would cause.
  const [loadedForId, setLoadedForId] = useState(predictionId)
  if (predictionId !== loadedForId) {
    setLoadedForId(predictionId)
    setMessages(chatStorage.load(predictionId))
    setConversationId(undefined)
    setNoPredictionNoticeShown(false)
    // A send still in flight for the *old* prediction will detect the ID
    // mismatch via latestPredictionIdRef and skip its own setIsSending(false)
    // (see sendMessage) — so this hook's fresh state for the new prediction
    // must reset it here instead, or the input would stay disabled forever.
    setIsSending(false)
  }

  // Mirrors `predictionId` for reads from inside already-in-flight async
  // callbacks (see sendMessage below) — a plain prop can't be "checked
  // later" once a closure has captured it, but a ref always reflects the
  // latest render.
  const latestPredictionIdRef = useRef(predictionId)
  latestPredictionIdRef.current = predictionId

  useEffect(() => {
    if (!predictionId) return
    // Only hydrate from the server when localStorage truly has nothing —
    // a browser with a local copy already has the fuller (live) message
    // shape (real citation excerpt text), which the server fallback can't
    // reconstruct (see getConversation's doc comment).
    if (chatStorage.load(predictionId).length > 0) return

    let cancelled = false
    setIsHydrating(true)
    analysisService
      .getConversation(predictionId)
      .then((result) => {
        if (cancelled || predictionId !== latestPredictionIdRef.current) return
        if (result.messages.length > 0) {
          setMessages(result.messages)
          setConversationId(result.conversationId ?? undefined)
        }
      })
      .catch(() => {
        // Non-fatal — the session just opens with an empty conversation,
        // same as any other prediction with no chat history yet.
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false)
      })

    return () => {
      cancelled = true
    }
  }, [predictionId])

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
          ...(noPredictionNoticeShown
            ? []
            : [
                createMessage(
                  'assistant',
                  'Please upload and identify a leaf image before asking questions.',
                ),
              ]),
        ])
        setNoPredictionNoticeShown(true)
        return
      }

      // Captured up front so a reply that resolves after the user has
      // already moved on to a new analysis (predictionId changed) can be
      // detected and dropped below, instead of being appended to — and
      // persisted into localStorage under — the wrong conversation.
      const requestPredictionId = predictionId

      setMessages((prev) => [...prev, createMessage('user', trimmed)])
      setIsSending(true)

      try {
        const result = await analysisService.sendChatMessage({
          predictionId,
          imageId,
          message: trimmed,
          conversationId,
        })
        if (requestPredictionId !== latestPredictionIdRef.current) return
        setConversationId(result.conversationId)
        setMessages((prev) => [...prev, result.message])
      } catch (error) {
        if (requestPredictionId !== latestPredictionIdRef.current) return
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
        if (requestPredictionId === latestPredictionIdRef.current) {
          setIsSending(false)
        }
      }
    },
    [predictionId, imageId, conversationId],
  )

  return {
    messages,
    sendMessage,
    isSending,
    isHydrating,
  }
}
