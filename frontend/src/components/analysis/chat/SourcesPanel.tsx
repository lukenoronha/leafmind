import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import type { Source } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface SourcesPanelProps {
  sources: Source[]
  className?: string
  /** Message ID this panel belongs to — used to scope citation anchors. */
  messageId?: string
  /** 1-based citation index to briefly highlight and scroll to. */
  highlightedIndex?: number | null
}

/**
 * Grounded-knowledge citation strip — a horizontally-scrolling row of
 * source cards (document, page/chapter, match score, excerpt) rather than
 * a vertical list, so the evidence behind an answer is glanceable at a
 * card's width instead of requiring a full read-down. Collapsed behind a
 * "Sources (N)" trigger by default so it doesn't compete with the answer
 * itself, but the strip layout is what makes opening it worthwhile.
 */
export function SourcesPanel({
  sources,
  className,
  messageId,
  highlightedIndex,
}: SourcesPanelProps) {
  const [open, setOpen] = useState(false)
  const highlightedRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  // Auto-expand when a citation is clicked, following React's "adjust
  // state during render" pattern instead of an effect (see
  // use-analysis-chat.ts for the same idiom) — this avoids the extra
  // render an effect-based open would cause.
  const [openedForIndex, setOpenedForIndex] = useState<number | null>(null)
  if (highlightedIndex && highlightedIndex !== openedForIndex) {
    setOpenedForIndex(highlightedIndex)
    setOpen(true)
  }

  useEffect(() => {
    if (!highlightedIndex) return
    // Wait for the collapsible's open animation before scrolling.
    const timeout = setTimeout(() => {
      highlightedRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }, 150)
    return () => clearTimeout(timeout)
  }, [highlightedIndex])

  if (sources.length === 0) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('bg-card w-full rounded-lg border', className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-foreground flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium"
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="text-primary size-3.5" />
            Grounded in {sources.length} source{sources.length === 1 ? '' : 's'}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <div
          role="group"
          aria-label={`${sources.length} cited source${sources.length === 1 ? '' : 's'}`}
          tabIndex={0}
          className="focus-visible:ring-ring/50 flex snap-x snap-mandatory gap-2 overflow-x-auto p-3 outline-none focus-visible:ring-2"
        >
          {sources.map((source, index) => {
            const citationIndex = index + 1
            const isHighlighted = highlightedIndex === citationIndex

            return (
              <motion.div
                key={source.chunkId}
                id={
                  messageId
                    ? `citation-${messageId}-${citationIndex}`
                    : undefined
                }
                ref={isHighlighted ? highlightedRef : undefined}
                initial={
                  prefersReducedMotion ? undefined : { opacity: 0, y: 6 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.04,
                  ease: 'easeOut',
                }}
                className={cn(
                  'bg-muted/50 flex w-56 shrink-0 snap-start flex-col gap-1.5 rounded-md border p-2.5 text-xs transition-colors duration-500',
                  isHighlighted
                    ? 'ring-primary bg-primary/10 ring-2'
                    : 'border-transparent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground shrink-0 font-mono">
                    {citationIndex}
                  </span>
                  <ConfidenceBadge value={source.score} className="shrink-0" />
                </div>
                <p className="text-foreground line-clamp-1 font-medium">
                  {source.documentName}
                </p>
                {source.chapter || source.pageNumber !== null ? (
                  <p className="text-muted-foreground">
                    {source.chapter}
                    {source.chapter && source.pageNumber !== null ? ' · ' : ''}
                    {source.pageNumber !== null
                      ? `Page ${source.pageNumber}`
                      : ''}
                  </p>
                ) : null}
                {source.text ? (
                  <p className="text-muted-foreground line-clamp-3 italic">
                    &ldquo;{source.text}&rdquo;
                  </p>
                ) : null}
              </motion.div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
