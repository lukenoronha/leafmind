import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { useRagAnalytics } from '@/hooks/use-developer-dashboard'
import { Database, FileStack, Gauge, Layers, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatDef {
  label: string
  value: string
  icon: LucideIcon
}

export function RagAnalyticsPanel() {
  const { data, isLoading, isError, refetch } = useRagAnalytics()

  const stats: StatDef[] | null = data
    ? [
        {
          label: 'Avg. retrieved documents',
          value: data.avgRetrievedDocuments.toFixed(1),
          icon: FileStack,
        },
        {
          label: 'Avg. similarity score',
          value: `${Math.round(data.avgSimilarityScore * 100)}%`,
          icon: Gauge,
        },
        {
          label: 'Avg. retrieval time',
          value: `${data.avgRetrievalTimeMs}ms`,
          icon: Timer,
        },
        {
          label: 'Embedding model',
          value: data.embeddingModel,
          icon: Layers,
        },
        {
          label: 'Vector count',
          value: data.vectorCount.toLocaleString(),
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load RAG analytics"
            description="We couldn't reach the RAG analytics endpoint."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  'bg-muted/30 flex flex-col gap-2 rounded-lg border p-3',
                )}
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
