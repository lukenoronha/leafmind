import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleGuard } from '@/routes/RoleGuard'
import { ROUTES } from '@/routes/paths'
import { Loader } from '@/components/common/Loader'
import RouteErrorPage from '@/pages/errors/RouteErrorPage'

// Auth pages are on the critical path for first paint (unauthenticated
// users land here first), so they stay eagerly bundled. Everything
// behind ProtectedRoute is lazy-loaded per route to keep the initial
// bundle small — most users only ever visit a handful of these.
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import SessionExpiredPage from '@/pages/errors/SessionExpiredPage'
import UnauthorizedPage from '@/pages/errors/UnauthorizedPage'
import NotFoundPage from '@/pages/errors/NotFoundPage'

const HomePage = lazy(() => import('@/pages/HomePage'))
const HistoryPage = lazy(() => import('@/pages/history/HistoryPage'))
const SavedReportsPage = lazy(
  () => import('@/pages/saved-reports/SavedReportsPage'),
)
const ChatHistoryPage = lazy(
  () => import('@/pages/chat-history/ChatHistoryPage'),
)
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const UserPage = lazy(() => import('@/pages/user/UserPage'))
const DeveloperPage = lazy(() => import('@/pages/developer/DeveloperPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const HelpPage = lazy(() => import('@/pages/help/HelpPage'))

function withSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<Loader fullScreen label="Loading..." />}>
      {element}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: ROUTES.signup,
    element: <SignupPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: ROUTES.forgotPassword,
    element: <ForgotPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: ROUTES.resetPassword,
    element: <ResetPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: ROUTES.sessionExpired,
    element: <SessionExpiredPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: ROUTES.unauthorized,
    element: <UnauthorizedPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.home, element: withSuspense(<HomePage />) },
          { path: ROUTES.history, element: withSuspense(<HistoryPage />) },
          {
            path: ROUTES.savedReports,
            element: withSuspense(<SavedReportsPage />),
          },
          {
            path: ROUTES.chatHistory,
            element: withSuspense(<ChatHistoryPage />),
          },
          {
            path: ROUTES.dashboard,
            element: withSuspense(<DashboardPage />),
          },
          { path: ROUTES.user, element: withSuspense(<UserPage />) },
          {
            path: ROUTES.settings,
            element: withSuspense(<SettingsPage />),
          },
          { path: ROUTES.help, element: withSuspense(<HelpPage />) },
          {
            element: <RoleGuard allowedRoles={['developer', 'admin']} />,
            children: [
              {
                path: ROUTES.developer,
                element: withSuspense(<DeveloperPage />),
              },
            ],
          },
          {
            element: <RoleGuard allowedRoles={['admin']} />,
            children: [
              { path: ROUTES.admin, element: withSuspense(<AdminPage />) },
            ],
          },
        ],
      },
    ],
  },
  {
    path: ROUTES.notFound,
    element: <NotFoundPage />,
    errorElement: <RouteErrorPage />,
  },
])
