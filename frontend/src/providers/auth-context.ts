import { createContext } from 'react'
import type { AuthState, AuthUser } from '@/types/auth'

export interface AuthContextValue extends AuthState {
  setUser: (user: AuthUser | null) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
