import { env } from '@/config/env'
import { tokenStorage } from '@/lib/token-storage'

/**
 * NDJSON stream events emitted by the RAG chat endpoint. The backend
 * writes one JSON object per line as the pipeline progresses, ending
 * with a `done` (or `error`) event.
 */
export type ChatStreamEvent =
  | { type: 'status'; stage: 'searching' | 'retrieved' | 'generating' }
  | { type: 'sources'; sources: import('@/types/analysis').Source[] }
  | { type: 'token'; content: string }
  | {
      type: 'done'
      messageId: string
      responseConfidence: number
      createdAt: string
    }
  | { type: 'error'; message: string }

/**
 * Posts to a streaming endpoint and yields parsed NDJSON events as they
 * arrive. Uses the native fetch Streams API directly rather than Axios —
 * Axios's browser adapters don't give reliable incremental access to a
 * response body, while fetch's ReadableStream does. Every other request
 * in the app still goes through the shared Axios client in api-client.ts.
 */
export async function* streamChat(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const token = tokenStorage.getAccessToken()

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        yield JSON.parse(trimmed) as ChatStreamEvent
      }
    }

    const trimmed = buffer.trim()
    if (trimmed) {
      yield JSON.parse(trimmed) as ChatStreamEvent
    }
  } finally {
    reader.releaseLock()
  }
}
