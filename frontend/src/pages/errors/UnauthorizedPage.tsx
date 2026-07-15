import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorPageLayout } from '@/components/common/ErrorPageLayout'
import { ROUTES } from '@/routes/paths'

export default function UnauthorizedPage() {
  return (
    <ErrorPageLayout
      icon={ShieldAlert}
      iconClassName="text-destructive"
      title="Access denied"
      description="You don't have permission to view this page."
      actions={
        <Button asChild>
          <Link to={ROUTES.home}>Back to home</Link>
        </Button>
      }
    />
  )
}
