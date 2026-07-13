import { createContext } from 'react'
import type { AuthState, AuthUser } from '@/types/auth'
import type { LoginPayload, SignupPayload } from '@/services/auth.service'

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
