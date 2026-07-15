import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AuthContext,
  CURRENT_USER_QUERY_KEY,
  type AuthContextValue,
} from '@/providers/auth-context'
import type { AuthUser } from '@/types/auth'
import {
  authService,
  type LoginPayload,
  type SignupPayload,
} from '@/services/auth.service'
import { tokenStorage } from '@/lib/token-storage'
import { authEvents } from '@/lib/auth-events'
import { router } from '@/routes/router'
import { ROUTES } from '@/routes/paths'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(
    () => !!tokenStorage.getAccessToken(),
  )

  const {
    data: user,
    isLoading: isBootstrapping,
    isFetching: isRevalidating,
  } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      const { data } = await authService.getCurrentUser()
      return data
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const clearSession = useCallback(() => {
    tokenStorage.clear()
    setHasToken(false)
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null)
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
  }, [queryClient])

  useEffect(() => {
    return authEvents.onSessionExpired(() => {
      clearSession()
      void router.navigate(ROUTES.sessionExpired, { replace: true })
    })
  }, [clearSession])

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: ({ data }) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken)
      setHasToken(true)
      queryClient.setQueryData<AuthUser>(CURRENT_USER_QUERY_KEY, data.user)
    },
  })

  const signupMutation = useMutation({
    mutationFn: (payload: SignupPayload) => authService.signup(payload),
    onSuccess: ({ data }) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken)
      setHasToken(true)
      queryClient.setQueryData<AuthUser>(CURRENT_USER_QUERY_KEY, data.user)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      clearSession()
    },
  })

  const login = useCallback(
    async (payload: LoginPayload) => {
      const result = await loginMutation.mutateAsync(payload)
      return result.data.user
    },
    [loginMutation],
  )

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const result = await signupMutation.mutateAsync(payload)
      return result.data.user
    },
    [signupMutation],
  )

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync().catch(() => {
      // Token is cleared client-side regardless of backend response.
    })
  }, [logoutMutation])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: hasToken && (isBootstrapping || isRevalidating) && !user,
      login,
      signup,
      logout,
      isLoginPending: loginMutation.isPending,
      isSignupPending: signupMutation.isPending,
    }),
    [
      user,
      hasToken,
      isBootstrapping,
      isRevalidating,
      login,
      signup,
      logout,
      loginMutation.isPending,
      signupMutation.isPending,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
