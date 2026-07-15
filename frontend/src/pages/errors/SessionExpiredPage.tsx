import { Link } from 'react-router-dom'
import { TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorPageLayout } from '@/components/common/ErrorPageLayout'
import { ROUTES } from '@/routes/paths'

export default function SessionExpiredPage() {
  return (
    <ErrorPageLayout
      icon={TimerReset}
      title="Your session has expired"
      description="For your security, please sign in again to continue."
      actions={
        <Button asChild>
          <Link to={ROUTES.login}>Sign in again</Link>
        </Button>
      }
    />
  )
}
