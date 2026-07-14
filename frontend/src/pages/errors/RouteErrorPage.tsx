import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'
import { ROUTES } from '@/routes/paths'

/**
 * Router-level errorElement. Catches render/loader errors thrown while
 * navigating to a route (e.g. a component throwing during render) so
 * the user sees a recoverable page instead of a blank screen.
 */
export default function RouteErrorPage() {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <AlertTriangle className="text-destructive size-10" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button asChild>
          <Link to={ROUTES.home}>Back to home</Link>
        </Button>
      </div>
    </div>
  )
}
