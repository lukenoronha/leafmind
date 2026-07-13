import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleGuard } from '@/routes/RoleGuard'
import { ROUTES } from '@/routes/paths'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import HomePage from '@/pages/HomePage'
import HistoryPage from '@/pages/history/HistoryPage'
import SavedReportsPage from '@/pages/saved-reports/SavedReportsPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UserPage from '@/pages/user/UserPage'
import DeveloperPage from '@/pages/developer/DeveloperPage'
import AdminPage from '@/pages/admin/AdminPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import SessionExpiredPage from '@/pages/errors/SessionExpiredPage'
import UnauthorizedPage from '@/pages/errors/UnauthorizedPage'
import NotFoundPage from '@/pages/errors/NotFoundPage'

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: ROUTES.signup, element: <SignupPage /> },
  { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
  { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
  { path: ROUTES.sessionExpired, element: <SessionExpiredPage /> },
  { path: ROUTES.unauthorized, element: <UnauthorizedPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.history, element: <HistoryPage /> },
          { path: ROUTES.savedReports, element: <SavedReportsPage /> },
          { path: ROUTES.dashboard, element: <DashboardPage /> },
          { path: ROUTES.user, element: <UserPage /> },
          { path: ROUTES.settings, element: <SettingsPage /> },
          {
            element: <RoleGuard allowedRoles={['developer', 'admin']} />,
            children: [{ path: ROUTES.developer, element: <DeveloperPage /> }],
          },
          {
            element: <RoleGuard allowedRoles={['admin']} />,
            children: [{ path: ROUTES.admin, element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
  { path: ROUTES.notFound, element: <NotFoundPage /> },
])
