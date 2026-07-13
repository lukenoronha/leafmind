import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/types/auth'
import { ROUTES } from '@/routes/paths'

interface RoleGuardProps {
  allowedRoles: UserRole[]
}

/**
 * Authorization guard. Assumes it renders beneath ProtectedRoute, so
 * the user is already known to be authenticated — this only checks
 * whether their role is permitted for the nested routes.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user } = useAuth()

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.unauthorized} replace />
  }

  return <Outlet />
}
