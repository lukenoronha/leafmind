import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/types/auth'
import { ROUTES } from '@/routes/paths'
import { Loader } from '@/components/common/Loader'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

/**
 * Route guard placeholder. Gates on the client-side AuthProvider state
 * only — no token verification or backend calls yet. Real auth logic
 * (session checks, refresh, redirects) lands with the FastAPI auth API.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return <Loader fullScreen label="Checking your session..." />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.home} replace />
  }

  return <Outlet />
}
