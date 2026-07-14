import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import { analysisService } from '@/services/analysis.service'

interface SourcesTabProps {
  predictionId: string
}

/**
 * Full-width version of the same related-knowledge data shown collapsed
 * in PredictionResultCard — shares a query key with it, so this is served
 * from cache rather than firing a second request in the common case where
 * the card already loaded it.
 */
export function SourcesTab({ predictionId }: SourcesTabProps) {
  const report = useQuery({
    queryKey: ['analysis', 'prediction-report', predictionId],
    queryFn: () => analysisService.getPredictionReport(predictionId),
  })

  if (report.isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    )
  }

  if (report.isError) {
    return (
      <p className="text-destructive p-4 text-sm">
        Unable to load related knowledge right now.
      </p>
    )
  }

  if (
    !report.data?.knowledgeAvailable ||
    report.data.relatedKnowledge.length === 0
  ) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <BookOpen className="text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">
          No information about this species is available in the knowledge base
          yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {report.data.relatedKnowledge.map((chunk, index) => (
        <div
          key={`${chunk.documentName}-${index}`}
          className="bg-muted/50 space-y-1.5 rounded-lg border p-3 text-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground font-medium">{chunk.documentName}</p>
            <ConfidenceBadge value={chunk.score} className="shrink-0" />
          </div>
          {chunk.chapter || chunk.pageNumber !== null ? (
            <p className="text-muted-foreground text-xs">
              {chunk.chapter}
              {chunk.chapter && chunk.pageNumber !== null ? ' · ' : ''}
              {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : ''}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs italic">
            &ldquo;{chunk.text}&rdquo;
          </p>
        </div>
      ))}
    </div>
  )
}
