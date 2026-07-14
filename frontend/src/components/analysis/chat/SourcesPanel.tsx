import { useEffect, useRef, useState } from 'react'
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

export function SourcesPanel({
  sources,
  className,
  messageId,
  highlightedIndex,
}: SourcesPanelProps) {
  const [open, setOpen] = useState(false)
  const highlightedRef = useRef<HTMLDivElement>(null)

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
            Sources ({sources.length})
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t px-3 py-2">
        {sources.map((source, index) => {
          const citationIndex = index + 1
          const isHighlighted = highlightedIndex === citationIndex

          return (
            <div
              key={source.id}
              id={
                messageId ? `citation-${messageId}-${citationIndex}` : undefined
              }
              ref={isHighlighted ? highlightedRef : undefined}
              className={cn(
                'bg-muted/50 flex items-start gap-3 rounded-md p-2 text-xs transition-colors duration-500',
                isHighlighted && 'ring-primary bg-primary/10 ring-2',
              )}
            >
              <span className="text-muted-foreground shrink-0 font-mono">
                {citationIndex}.
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-foreground truncate font-medium">
                  {source.documentTitle}
                </p>
                <p className="text-muted-foreground">
                  {source.chapter} &middot; Page {source.pageNumber}
                </p>
                {source.excerpt ? (
                  <p className="text-muted-foreground mt-1 line-clamp-2 italic">
                    &ldquo;{source.excerpt}&rdquo;
                  </p>
                ) : null}
              </div>
              <ConfidenceBadge
                value={source.retrievalConfidence}
                className="shrink-0"
              />
            </div>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
