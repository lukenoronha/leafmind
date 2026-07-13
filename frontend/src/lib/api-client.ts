import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'
import { tokenStorage } from '@/lib/token-storage'
import { authEvents } from '@/lib/auth-events'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
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

    if (!shouldAttemptRefresh) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const newAccessToken = await refreshAccessToken()

    if (!newAccessToken) {
      tokenStorage.clear()
      authEvents.emitSessionExpired()
      return Promise.reject(error)
    }

    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
    return apiClient(originalRequest)
  },
)
