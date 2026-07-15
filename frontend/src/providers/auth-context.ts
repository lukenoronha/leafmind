import { createContext } from 'react'
import type { AuthState, AuthUser } from '@/types/auth'
import type { LoginPayload, SignupPayload } from '@/services/auth.service'

/** Cache key for the current-user query. Lives here (not in
 * AuthProvider.tsx) so profile mutations (hooks/use-profile.ts) can write
 * the fresh user from PATCH /auth/me and POST /auth/me/avatar into the
 * same entry without breaking the provider file's fast refresh. */
export const CURRENT_USER_QUERY_KEY = ['auth', 'current-user'] as const

export interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<AuthUser>
  signup: (payload: SignupPayload) => Promise<AuthUser>
  logout: () => Promise<void>
  isLoginPending: boolean
  isSignupPending: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
