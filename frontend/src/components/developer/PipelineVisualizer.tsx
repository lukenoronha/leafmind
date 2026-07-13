import { Check, Loader2, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { usePipelineStages } from '@/hooks/use-developer-dashboard'
import type { PipelineStage, PipelineStageStatus } from '@/types/developer'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<PipelineStageStatus, string> = {
  pending: 'border-border bg-muted text-muted-foreground',
  running: 'border-primary bg-primary/10 text-primary',
  complete: 'border-success bg-success/10 text-success',
  error: 'border-destructive bg-destructive/10 text-destructive',
}

function StageIcon({ status }: { status: PipelineStageStatus }) {
  if (status === 'running') return <Loader2 className="size-4 animate-spin" />
  if (status === 'complete') return <Check className="size-4" />
  if (status === 'error') return <X className="size-4" />
  return <span className="size-2 rounded-full bg-current" />
}

function formatDuration(ms?: number) {
  if (ms === undefined) return null
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function PipelineStep({
  stage,
  isLast,
}: {
  stage: PipelineStage
  isLast: boolean
}) {
  return (
    <div className="flex flex-1 items-center">
      <div className="flex min-w-0 flex-col items-center gap-2 text-center">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full border-2',
            STATUS_STYLES[stage.status],
          )}
        >
          <StageIcon status={stage.status} />
        </div>
        <div className="space-y-0.5">
          <p className="text-foreground text-xs font-medium">{stage.label}</p>
          {stage.durationMs !== undefined ? (
            <p className="text-muted-foreground text-xs">
              {formatDuration(stage.durationMs)}
            </p>
          ) : null}
        </div>
      </div>
      {!isLast ? (
        <div
          className={cn(
            'mx-1 h-0.5 flex-1 rounded-full',
            stage.status === 'complete' ? 'bg-success' : 'bg-border',
          )}
        />
      ) : null}
    </div>
  )
}

export function PipelineVisualizer() {
  const { data, isLoading, isError, refetch } = usePipelineStages()

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI pipeline</CardTitle>
        <CardDescription>
          Every stage a request passes through, from image upload to generated
          response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : isError ? (
          <ErrorState
            title="Unable to load pipeline status"
            description="We couldn't reach the pipeline endpoint."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="flex items-start overflow-x-auto pb-2">
            {data?.map((stage, index) => (
              <PipelineStep
                key={stage.id}
                stage={stage}
                isLast={index === data.length - 1}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
