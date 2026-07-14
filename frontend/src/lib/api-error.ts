import { isAxiosError } from 'axios'

interface ApiErrorBody {
  message?: string
  detail?: string
}

/**
 * Extracts a human-readable message from an Axios error, falling back
 * to a caller-supplied default when the response has no usable body
 * (network failure, non-JSON error, or an endpoint that doesn't exist
 * yet on the placeholder backend).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    return (
      error.response?.data?.message ?? error.response?.data?.detail ?? fallback
    )
  }
  return fallback
}

export type ApiErrorKind =
  'network' | 'timeout' | 'server' | 'client' | 'unknown'

/**
 * Classifies an Axios error so callers (mainly the global response
 * interceptor) can decide how loudly to surface it. A request that
 * never reached the server (network down, CORS, DNS) has no
 * `error.response`; a timeout has `error.code === 'ECONNABORTED'`.
 */
export function classifyApiError(error: unknown): ApiErrorKind {
  if (!isAxiosError(error)) return 'unknown'
  if (error.code === 'ECONNABORTED') return 'timeout'
  if (!error.response) return 'network'
  if (error.response.status >= 500) return 'server'
  if (error.response.status >= 400) return 'client'
  return 'unknown'
}
