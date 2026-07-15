import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorPageLayout } from '@/components/common/ErrorPageLayout'
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
    <ErrorPageLayout
      icon={AlertTriangle}
      iconClassName="text-destructive"
      title="Something went wrong"
      description={message}
      actions={
        <>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button asChild>
            <Link to={ROUTES.home}>Back to home</Link>
          </Button>
        </>
      }
    />
  )
}
