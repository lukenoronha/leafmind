import { Link } from 'react-router-dom'
import { TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/routes/paths'
import { Logo } from '@/components/common/Logo'

export default function SessionExpiredPage() {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="flex flex-col items-center gap-4">
        <TimerReset className="text-muted-foreground size-10" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your session has expired
          </h1>
          <p className="text-muted-foreground">
            For your security, please sign in again to continue.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.login}>Sign in again</Link>
        </Button>
      </div>
    </div>
  )
}
