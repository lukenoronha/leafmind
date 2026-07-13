export type UserRole = 'user' | 'developer' | 'admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}
