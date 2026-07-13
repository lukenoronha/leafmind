import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { User } from 'lucide-react'

export default function UserPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        description="Manage your profile and identification history."
      />
      <EmptyState
        icon={User}
        title="User profile coming soon"
        description="Profile details will be available once accounts are wired to the backend."
      />
    </div>
  )
}
