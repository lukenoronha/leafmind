import { Activity, BrainCircuit, Database, FileStack, Gauge, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiCard } from '@/components/developer/KpiCard'
import { useAnalyticsSummary } from '@/hooks/use-developer-dashboard'

interface KpiDef {
  id: string
  label: string
  value: string
  icon: LucideIcon
}

/** Real aggregate counts/averages from GET /developer/analytics — the
 * backend has no bespoke "KPI" endpoint, so these cards are a relabeling
 * of AnalyticsSummary's fields rather than a separate concept. */
export function KpiGrid() {
  const { data, isLoading, isError, refetch } = useAnalyticsSummary()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Unable to load KPIs"
        description="We couldn't reach the analytics endpoint."
        onRetry={() => void refetch()}
      />
    )
  }

  const metrics: KpiDef[] = [
    {
      id: 'total-uploads',
      label: 'Total uploads',
      value: data.totalUploads.toLocaleString(),
      icon: Activity,
    },
    {
      id: 'prediction-count',
      label: 'Predictions',
      value: data.predictionCount.toLocaleString(),
      icon: FileStack,
    },
    {
      id: 'avg-confidence',
      label: 'Avg. confidence',
      value:
        data.avgConfidence !== null
          ? `${Math.round(data.avgConfidence * 100)}%`
          : '—',
      icon: Gauge,
    },
    {
      id: 'avg-inference',
      label: 'Avg. inference time',
      value:
        data.avgInferenceMs !== null ? `${Math.round(data.avgInferenceMs)}ms` : '—',
      icon: Timer,
    },
    {
      id: 'indexed-documents',
      label: 'Indexed documents',
      value: data.indexedDocuments.toLocaleString(),
      icon: BrainCircuit,
    },
    {
      id: 'vector-count',
      label: 'Vector count',
      value: data.vectorCount.toLocaleString(),
      icon: Database,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <KpiCard key={metric.id} metric={metric} icon={metric.icon} />
      ))}
    </div>
  )
}
