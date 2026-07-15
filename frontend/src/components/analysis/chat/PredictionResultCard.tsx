import { forwardRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, Cpu, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SourcesPanel } from '@/components/analysis/chat/SourcesPanel'
import { PredictionMediaBand } from '@/components/analysis/chat/PredictionMediaBand'
import { PredictionConfidenceBadge } from '@/components/analysis/chat/PredictionConfidenceBadge'
import { analysisService } from '@/services/analysis.service'
import type { Prediction, Source } from '@/types/analysis'
import { getConfidenceTier } from '@/lib/confidence'
import { cn } from '@/lib/utils'

interface PredictionResultCardProps {
  prediction: Prediction
  /** Local preview of the photo this prediction was made from, if still
   * available (blob URLs don't survive a page reload). */
  imageUrl?: string | null
  /** Opens the Inspector panel (Task 10) to the given tab, scoped to this
   * card's prediction. */
  onOpenInspector: (tab: 'explainability' | 'sources') => void
  className?: string
}

/**
 * Prediction result rendered as a message in the chat feed. Only shows
 * fields the backend actually returns — plant name, confidence, runner-up
 * candidates, model/timing metadata, and real RAG-grounded excerpts.
 * There is no scientific name, family, toxicity, or compound data in the
 * API today, so this deliberately does not fabricate tabs for them.
 */
export const PredictionResultCard = forwardRef<
  HTMLDivElement,
  PredictionResultCardProps
>(function PredictionResultCard(
  { prediction, imageUrl, onOpenInspector, className },
  ref,
) {
  const prefersReducedMotion = useReducedMotion()
  const tier = getConfidenceTier(prediction.confidence)
  const runnerUp = prediction.candidates[1]

  // Fetched eagerly (SourcesPanel below owns its own open/closed state and
  // "Sources (N)" count once loaded). Shares a query key with HomePage's
  // own eager fetch (kept there for the print view), so React Query serves
  // this from that same cached response rather than firing a second
  // request.
  const report = useQuery({
    queryKey: ['analysis', 'prediction-report', prediction.id],
    queryFn: () => analysisService.getPredictionReport(prediction.id),
  })

  // RelatedKnowledgeChunk has no stable id (unlike chat Source) — synthesize
  // one from its position so SourcesPanel (built for Source[]) can be
  // reused here instead of duplicating its rendering.
  const knowledgeAsSources: Source[] =
    report.data?.relatedKnowledge.map((chunk, index) => ({
      chunkId: `${prediction.id}-${index}`,
      documentId: `${prediction.id}-${index}`,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
      chapter: chunk.chapter,
      score: chunk.score,
      text: chunk.text,
    })) ?? []

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'bg-card w-full max-w-[85%] overflow-hidden rounded-2xl rounded-tl-sm border shadow-sm',
        (tier === 'low' || prediction.status === 'low_confidence') &&
          'border-destructive/40 border-dashed',
        tier === 'very-low' && 'border-destructive/60 border-dashed',
        className,
      )}
    >
      <PredictionMediaBand
        imageUrl={imageUrl ?? null}
        plantName={prediction.plantName}
      />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-lg font-semibold">
            {prediction.plantName}
          </p>
          <PredictionConfidenceBadge value={prediction.confidence} />
        </div>

        {prediction.status === 'low_confidence' && prediction.message ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{prediction.message}</span>
          </div>
        ) : null}

        {tier === 'medium' && runnerUp ? (
          <p className="text-muted-foreground text-xs">
            I&apos;m fairly confident, but it could also be{' '}
            <span className="text-foreground font-medium">
              {runnerUp.label}
            </span>{' '}
            ({Math.round(runnerUp.confidence * 100)}%).
          </p>
        ) : null}

        {(tier === 'low' || tier === 'very-low') && runnerUp ? (
          <p className="text-muted-foreground text-xs">
            This is a harder one to place confidently. Other possibilities:{' '}
            <span className="text-foreground font-medium">
              {runnerUp.label}
            </span>{' '}
            ({Math.round(runnerUp.confidence * 100)}%). A closer, well-lit photo
            would help me narrow it down.
          </p>
        ) : null}

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Cpu className="size-3.5" />
          {prediction.modelVersion}
        </div>

        {report.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : report.isError ? (
          <p className="text-destructive text-xs">
            Unable to load related knowledge right now.
          </p>
        ) : report.data?.knowledgeAvailable ? (
          <SourcesPanel sources={knowledgeAsSources} />
        ) : (
          <p className="text-muted-foreground text-xs">
            No information about this species is available in the knowledge base
            yet.
          </p>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-auto gap-1.5 px-2 py-1 text-xs"
            onClick={() => onOpenInspector('explainability')}
          >
            <Sparkles className="size-3.5" />
            See why
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-auto gap-1.5 px-2 py-1 text-xs"
            onClick={() => onOpenInspector('sources')}
          >
            View sources
          </Button>
        </div>
      </div>
    </motion.div>
  )
})
