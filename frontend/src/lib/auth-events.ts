type SessionExpiredHandler = () => void

let sessionExpiredHandler: SessionExpiredHandler | null = null

/**
 * Bridges the Axios interceptor (which runs outside React) to the
 * AuthProvider (which owns navigation and auth state). AuthProvider
 * registers a handler on mount; the interceptor calls it on an
 * unrecoverable 401 (expired session, failed refresh).
 */
export const authEvents = {
  onSessionExpired: (handler: SessionExpiredHandler) => {
    sessionExpiredHandler = handler
    return () => {
      if (sessionExpiredHandler === handler) {
        sessionExpiredHandler = null
      }
    }
  },
  emitSessionExpired: () => {
    sessionExpiredHandler?.()
  },
}
