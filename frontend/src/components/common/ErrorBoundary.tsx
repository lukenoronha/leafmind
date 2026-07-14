import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'

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
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo />
        <AlertTriangle className="text-destructive size-10" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            LeafMind hit a snag
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Something went wrong loading the application. Reloading usually
            fixes this.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    )
  }
}
