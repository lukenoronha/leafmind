import { Activity, BrainCircuit, Gauge, Timer, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiCard } from '@/components/developer/KpiCard'
import { useKpis } from '@/hooks/use-developer-dashboard'

const ICON_BY_ID: Record<string, LucideIcon> = {
  'total-predictions': Activity,
  'avg-confidence': Gauge,
  'avg-latency': Timer,
  'active-users': Users,
  'rag-queries': BrainCircuit,
  'model-uptime': Zap,
}

export function KpiGrid() {
  const { data, isLoading, isError, refetch } = useKpis()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load KPIs"
        description="We couldn't reach the analytics endpoint."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {data?.map((metric) => (
        <KpiCard
          key={metric.id}
          metric={metric}
          icon={ICON_BY_ID[metric.id] ?? Activity}
        />
      ))}
    </div>
  )
}
