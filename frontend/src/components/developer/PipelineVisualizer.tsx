import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { useAverageTimings } from '@/hooks/use-developer-dashboard'
import type { AverageTimings } from '@/types/developer'

interface StageDef {
  id: string
  label: string
  averageMs: (timings: AverageTimings) => number | null
}

// Static description of the real pipeline stages — the backend has no
// live "request in progress" concept to report, only averages aggregated
// across all persisted predictions/chat turns (GET /developer/metrics/timings).
const STAGES: StageDef[] = [
  {
    id: 'preprocessing',
    label: 'Preprocessing',
    averageMs: (t) => t.avgPreprocessingMs,
  },
  {
    id: 'inference',
    label: 'Inference',
    averageMs: (t) => t.avgPredictionInferenceMs,
  },
  {
    id: 'retrieval',
    label: 'Retrieval',
    averageMs: (t) => t.avgRetrievalMs,
  },
  {
    id: 'generation',
    label: 'Response generation',
    averageMs: (t) => t.avgChatInferenceMs,
  },
]

function formatDuration(ms: number | null) {
  if (ms === null) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function PipelineVisualizer() {
  const { data, isLoading, isError, refetch } = useAverageTimings()

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI pipeline</CardTitle>
        <CardDescription>
          Average time spent in each stage, aggregated across all persisted
          predictions and chat turns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : isError || !data ? (
          <ErrorState
            title="Unable to load pipeline timings"
            description="We couldn't reach the timings endpoint."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className="bg-muted/30 flex flex-col gap-1 rounded-lg border p-3"
              >
                <p className="text-muted-foreground text-xs">{stage.label}</p>
                <p className="text-foreground text-lg font-semibold">
                  {formatDuration(stage.averageMs(data))}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
