import { Database, FileText, HeartPulse, Layers, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiCard } from '@/components/developer/KpiCard'
import { useAdminKpis } from '@/hooks/use-admin-kpis'

const ICON_BY_ID: Record<string, LucideIcon> = {
  'total-users': Users,
  'active-datasets': Database,
  'kb-documents': FileText,
  'vector-count': Layers,
  'system-health': HeartPulse,
}

export function AdminKpiGrid() {
  const { data, isLoading, isError, refetch } = useAdminKpis()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load KPIs"
        description="We couldn't reach the admin analytics endpoint."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {data?.map((metric) => (
        <KpiCard
          key={metric.id}
          metric={metric}
          icon={ICON_BY_ID[metric.id] ?? Users}
        />
      ))}
    </div>
  )
}
