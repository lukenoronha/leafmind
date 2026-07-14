import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { ImageFeedStatus } from '@/components/analysis/chat/ChatPanel'
import { cn } from '@/lib/utils'

interface ProcessingTimelineProps {
  status: Extract<ImageFeedStatus, 'uploading' | 'analyzing'>
  /** 0-100, only meaningful while status is 'uploading'. */
  progress?: number
  className?: string
}

interface Stage {
  key: 'reading' | 'identifying'
  label: string
}

// Deliberately two stages, not four. The backend only exposes two real
// signals during prediction: an upload with live progress, then a single
// opaque predict() call with no sub-steps. Knowledge retrieval (RAG) isn't
// part of this wait at all — it happens later, per question, in chat — so
// showing "Consulting knowledge" here would claim a step that isn't
// actually happening yet. See PredictionResultCard/SourcesPanel for where
// that grounding is real and shown.
const STAGES: Stage[] = [
  { key: 'reading', label: 'Reading your photo' },
  { key: 'identifying', label: 'Identifying the species' },
]

/**
 * Replaces a generic spinner with a small staged trace so the wait reads
 * as the system doing legible work rather than an opaque loading state.
 */
export function ProcessingTimeline({
  status,
  progress,
  className,
}: ProcessingTimelineProps) {
  const prefersReducedMotion = useReducedMotion()
  const activeIndex = status === 'uploading' ? 0 : 1

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {STAGES.map((stage, index) => {
        const isDone = index < activeIndex
        const isActive = index === activeIndex

        return (
          <div key={stage.key} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                isDone && 'border-primary bg-primary',
                isActive && 'border-primary',
                !isDone && !isActive && 'border-muted-foreground/30',
              )}
            >
              {isDone ? (
                <Check
                  className="text-primary-foreground size-2.5"
                  strokeWidth={3}
                />
              ) : isActive ? (
                <motion.span
                  animate={
                    prefersReducedMotion ? undefined : { opacity: [1, 0.35, 1] }
                  }
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="bg-primary size-1.5 rounded-full"
                />
              ) : null}
            </span>

            <span
              className={cn(
                'text-xs transition-colors',
                isActive && 'text-foreground font-medium',
                isDone && 'text-muted-foreground line-through',
                !isDone && !isActive && 'text-muted-foreground/50',
              )}
            >
              {stage.label}
              {isActive &&
              stage.key === 'reading' &&
              typeof progress === 'number'
                ? ` · ${Math.round(progress)}%`
                : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
