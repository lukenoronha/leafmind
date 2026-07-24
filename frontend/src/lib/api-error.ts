import { isAxiosError } from 'axios'

interface ApiFieldError {
  loc?: (string | number)[]
  msg?: string
}

interface ApiErrorBody {
  // Actual LeafMind response contract: { success, error: { message, details } }
  error?: {
    message?: string
    details?: ApiFieldError[] | string | null
  }
  // Defensive fallbacks in case an endpoint ever returns a flatter shape.
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
    const body = error.response?.data
    if (body?.error?.message) {
      // 422s carry a generic "Request validation failed" message with the
      // real per-field reason in `details` — prefer that when present.
      if (Array.isArray(body.error.details) && body.error.details.length > 0) {
        const first = body.error.details[0]
        if (first?.msg) return first.msg
      }
      return body.error.message
    }
    return body?.message ?? body?.detail ?? fallback
  }
  return fallback
}

/**
 * Maps backend 422 field-validation errors onto individual form fields via
 * React Hook Form's `setError`, so they render inline instead of as a toast.
 * Returns true if at least one field error was applied.
 */
export function applyApiFieldErrors<TField extends string>(
  error: unknown,
  setError: (field: TField, err: { message: string }) => void,
  fieldMap: Record<string, string> = {},
): boolean {
  if (!isAxiosError<ApiErrorBody>(error)) return false
  const details = error.response?.data?.error?.details
  if (!Array.isArray(details)) return false

  let applied = false
  for (const detail of details) {
    const backendField = detail.loc?.[detail.loc.length - 1]
    if (typeof backendField !== 'string' || !detail.msg) continue
    const field = (fieldMap[backendField] ?? backendField) as TField
    setError(field, { message: detail.msg })
    applied = true
  }
  return applied
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
