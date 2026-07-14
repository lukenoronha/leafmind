import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { env } from '@/config/env'
import { tokenStorage } from '@/lib/token-storage'
import { authEvents } from '@/lib/auth-events'
import { classifyApiError } from '@/lib/api-error'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh endpoint uses its own client to avoid recursing through the
// interceptor below when the refresh call itself returns 401.
const refreshClient = axios.create({ baseURL: env.apiBaseUrl })

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ accessToken: string; refreshToken?: string }>('/auth/refresh', {
        refreshToken,
      })
      .then(({ data }) => {
        tokenStorage.setTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// Throttles the "backend unreachable" toast so a burst of failing
// requests (e.g. several widgets polling at once) shows one message
// instead of one per request.
const NETWORK_TOAST_COOLDOWN_MS = 8_000
let lastNetworkToastAt = 0

function notifyUnreachable(message: string) {
  const now = Date.now()
  if (now - lastNetworkToastAt < NETWORK_TOAST_COOLDOWN_MS) return
  lastNetworkToastAt = now
  toast.error(message)
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/')
    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint

    if (shouldAttemptRefresh) {
      originalRequest._retry = true
      const newAccessToken = await refreshAccessToken()

      if (!newAccessToken) {
        tokenStorage.clear()
        authEvents.emitSessionExpired()
        return Promise.reject(error)
      }

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    }

    if (!isAuthEndpoint) {
      const kind = classifyApiError(error)
      if (kind === 'network') {
        notifyUnreachable(
          "Can't reach the LeafMind server. Check your connection and try again.",
        )
      } else if (kind === 'timeout') {
        notifyUnreachable('That request took too long and timed out.')
      } else if (kind === 'server') {
        notifyUnreachable(
          'LeafMind is having trouble on our end. Please try again shortly.',
        )
      }
    }

    return Promise.reject(error)
  },
)
