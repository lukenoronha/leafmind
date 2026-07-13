const ACCESS_TOKEN_KEY = 'leafmind_access_token'
const REFRESH_TOKEN_KEY = 'leafmind_refresh_token'

/**
 * Thin wrapper around localStorage for JWT persistence. Centralized so
 * the storage mechanism (and keys) can change in one place — e.g. if
 * refresh tokens move to an httpOnly cookie once the backend sets one.
 */
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens: (accessToken: string, refreshToken?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  },

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}
