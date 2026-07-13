import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { ROUTES } from '@/routes/paths'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import HomePage from '@/pages/HomePage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UserPage from '@/pages/user/UserPage'
import DeveloperPage from '@/pages/developer/DeveloperPage'
import AdminPage from '@/pages/admin/AdminPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import NotFoundPage from '@/pages/errors/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: <LoginPage />,
  },
  {
    path: ROUTES.signup,
    element: <SignupPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.dashboard, element: <DashboardPage /> },
          { path: ROUTES.user, element: <UserPage /> },
          { path: ROUTES.developer, element: <DeveloperPage /> },
          { path: ROUTES.admin, element: <AdminPage /> },
          { path: ROUTES.settings, element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: ROUTES.notFound,
    element: <NotFoundPage />,
  },
])
