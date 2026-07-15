import { Link } from 'react-router-dom'
import { CompassIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorPageLayout } from '@/components/common/ErrorPageLayout'
import { ROUTES } from '@/routes/paths'

export default function NotFoundPage() {
  return (
    <ErrorPageLayout
      icon={CompassIcon}
      title="Page not found"
      description="The page you're looking for doesn't exist."
      actions={
        <Button asChild>
          <Link to={ROUTES.home}>Back to home</Link>
        </Button>
      }
    />
  )
}
