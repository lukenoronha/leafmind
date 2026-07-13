import { Leaf } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Identify"
        description="Upload a leaf photo to identify medicinal plants."
      />
      <EmptyState
        icon={Leaf}
        title="Identification workspace coming soon"
        description="The vision-language identification flow will live here."
      />
    </div>
  )
}
