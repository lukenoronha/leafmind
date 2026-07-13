import { useState } from 'react'
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
}

export function SourcesPanel({ sources, className }: SourcesPanelProps) {
  const [open, setOpen] = useState(false)

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
        {sources.map((source) => (
          <div
            key={source.id}
            className="bg-muted/50 flex items-start justify-between gap-3 rounded-md p-2 text-xs"
          >
            <div className="min-w-0 space-y-0.5">
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
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
