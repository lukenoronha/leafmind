import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/routes/paths'
import { Loader } from '@/components/common/Loader'

/**
 * Gates nested routes on authentication only. Role checks live in
 * RoleGuard, nested inside this guard's subtree. On redirect, the
 * attempted location is passed via state so LoginPage can send the
 * user back after a successful sign-in.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <Loader fullScreen label="Checking your session..." />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />
  }

  return <Outlet />
}
