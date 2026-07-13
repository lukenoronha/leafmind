import { useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '@/providers/auth-context'
import type { AuthUser } from '@/types/auth'

/**
 * Placeholder auth provider. Holds only client-side state shape —
 * no backend calls, tokens, or persistence yet. Wired up once the
 * FastAPI auth endpoints exist.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading] = useState(false)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      setUser,
    }),
    [user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
