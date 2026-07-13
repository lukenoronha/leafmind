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
