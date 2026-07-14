import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { useAnalyticsSummary, useAverageTimings } from '@/hooks/use-developer-dashboard'
import { Database, FileStack, Layers, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatDef {
  label: string
  value: string
  icon: LucideIcon
}

export function RagAnalyticsPanel() {
  const analytics = useAnalyticsSummary()
  const timings = useAverageTimings()

  const isLoading = analytics.isLoading || timings.isLoading
  const isError = analytics.isError || timings.isError

  function refetchAll() {
    void analytics.refetch()
    void timings.refetch()
  }

  const stats: StatDef[] | null =
    analytics.data && timings.data
      ? [
          {
            label: 'Indexed documents',
            value: analytics.data.indexedDocuments.toLocaleString(),
            icon: FileStack,
          },
          {
            label: 'Total chunks',
            value: analytics.data.totalChunks.toLocaleString(),
            icon: Layers,
          },
          {
            label: 'Avg. retrieval time',
            value:
              analytics.data.avgRetrievalMs !== null
                ? `${Math.round(analytics.data.avgRetrievalMs)}ms`
                : '—',
            icon: Timer,
          },
          {
            label: 'Vector count',
            value: analytics.data.vectorCount.toLocaleString(),
            icon: Database,
          },
        ]
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>RAG analytics</CardTitle>
        <CardDescription>
          Retrieval performance across the vector knowledge base.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : isError || !stats ? (
          <ErrorState
            title="Unable to load RAG analytics"
            description="We couldn't reach the analytics endpoint."
            onRetry={refetchAll}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3"
              >
                <stat.icon className="text-primary size-4" />
                <p className="text-foreground text-lg font-semibold">
                  {stat.value}
                </p>
                <p className="text-muted-foreground text-xs">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
