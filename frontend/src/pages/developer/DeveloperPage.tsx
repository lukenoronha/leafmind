import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { TerminalSquare } from 'lucide-react'

export default function DeveloperPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        description="API keys, logs, and model diagnostics."
      />
      <EmptyState
        icon={TerminalSquare}
        title="Developer tools coming soon"
        description="This workspace will surface API usage and model diagnostics."
      />
    </div>
  )
}
