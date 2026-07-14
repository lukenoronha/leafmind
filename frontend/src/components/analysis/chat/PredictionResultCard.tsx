import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, BookOpen, ChevronDown, Cpu } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { analysisService } from '@/services/analysis.service'
import type { Prediction } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface PredictionResultCardProps {
  prediction: Prediction
  className?: string
}

function confidenceVariant(confidence: number) {
  if (confidence >= 0.85) return 'default'
  if (confidence >= 0.6) return 'secondary'
  return 'destructive'
}

/**
 * Prediction result rendered as a message in the chat feed (not a separate
 * side panel). The "related knowledge" section is collapsed by default and
 * only fetches GET /reports/prediction/{id} once expanded — it shows real
 * RAG-grounded excerpts, or an explicit "not available" message; never
 * fabricated medicinal content.
 */
export function PredictionResultCard({
  prediction,
  className,
}: PredictionResultCardProps) {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const confidencePercent = Math.round(prediction.confidence * 100)

  const report = useQuery({
    queryKey: ['analysis', 'prediction-report', prediction.id],
    queryFn: () => analysisService.getPredictionReport(prediction.id),
    enabled: knowledgeOpen,
  })

  return (
    <div
      className={cn(
        'bg-muted w-full max-w-[85%] space-y-3 rounded-2xl rounded-tl-sm border p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-foreground text-lg font-semibold">
            {prediction.plantName}
          </p>
          {prediction.candidates.length > 1 ? (
            <p className="text-muted-foreground text-xs">
              Runner-up: {prediction.candidates[1].label} (
              {Math.round(prediction.candidates[1].confidence * 100)}%)
            </p>
          ) : null}
        </div>
        <Badge variant={confidenceVariant(prediction.confidence)}>
          <BadgeCheck />
          {confidencePercent}% match
        </Badge>
      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Cpu className="size-3.5" />
        {prediction.modelVersion}
      </div>

      <Collapsible open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-foreground bg-card flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="text-primary size-3.5" />
              Related knowledge base information
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground size-3.5 transition-transform',
                knowledgeOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {report.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : report.isError ? (
            <p className="text-destructive text-xs">
              Unable to load related knowledge right now.
            </p>
          ) : report.data?.knowledgeAvailable ? (
            <div className="space-y-2">
              {report.data.relatedKnowledge.map((chunk, index) => (
                <div
                  key={`${chunk.documentName}-${index}`}
                  className="bg-card space-y-1 rounded-md border p-2 text-xs"
                >
                  <p className="text-foreground font-medium">
                    {chunk.documentName}
                    {chunk.pageNumber !== null ? `, p. ${chunk.pageNumber}` : ''}
                  </p>
                  <p className="text-muted-foreground italic">
                    &ldquo;{chunk.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No information about this species is available in the knowledge
              base yet.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
