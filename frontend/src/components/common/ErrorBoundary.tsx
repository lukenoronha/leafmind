import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorPageLayout } from '@/components/common/ErrorPageLayout'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Last-resort catch for render errors that occur outside the router's
 * reach (e.g. a provider throwing during initialization, before
 * RouterProvider mounts). Route-level errors are handled by
 * RouteErrorPage via the router's errorElement instead.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <ErrorPageLayout
        icon={AlertTriangle}
        iconClassName="text-destructive"
        title="LeafMind hit a snag"
        description="Something went wrong loading the application. Reloading usually fixes this."
        actions={
          <Button onClick={() => window.location.reload()}>Reload</Button>
        }
      />
    )
  }
}
