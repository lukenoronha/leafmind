import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { PresentationModeProvider } from '@/providers/PresentationModeProvider'
import { MotionPreferencesProvider } from '@/providers/MotionPreferencesProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { NetworkStatusBanner } from '@/components/common/NetworkStatusBanner'
import { router } from '@/routes/router'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <PresentationModeProvider>
              <MotionPreferencesProvider>
                <TooltipProvider>
                  <NetworkStatusBanner />
                  <RouterProvider router={router} />
                  <Toaster />
                </TooltipProvider>
              </MotionPreferencesProvider>
            </PresentationModeProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
