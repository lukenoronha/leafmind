import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/routes/paths'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="text-destructive size-10" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
      <Button asChild>
        <Link to={ROUTES.home}>Back to home</Link>
      </Button>
    </div>
  )
}
