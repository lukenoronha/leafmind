import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ShieldCheck } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Manage users, roles, and platform settings."
      />
      <EmptyState
        icon={ShieldCheck}
        title="Admin console coming soon"
        description="User and role management will be available here."
      />
    </div>
  )
}
