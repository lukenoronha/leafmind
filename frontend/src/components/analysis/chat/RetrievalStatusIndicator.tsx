import { Check, Loader2, Search, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RetrievalStage } from '@/types/analysis'

interface StepDef {
  stage: 'searching' | 'retrieved' | 'generating'
  label: string
  icon: LucideIcon
}

const STEPS: StepDef[] = [
  { stage: 'searching', label: 'Searching knowledge base', icon: Search },
  { stage: 'retrieved', label: 'Retrieved context', icon: Check },
  { stage: 'generating', label: 'Generating response', icon: Sparkles },
]

const STAGE_ORDER: RetrievalStage[] = [
  'searching',
  'retrieved',
  'generating',
  'done',
]

interface RetrievalStatusIndicatorProps {
  stage: RetrievalStage
  className?: string
}

export function RetrievalStatusIndicator({
  stage,
  className,
}: RetrievalStatusIndicatorProps) {
  if (stage === 'done' || stage === 'error') return null

  const currentIndex = STAGE_ORDER.indexOf(stage)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-muted/50 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border px-3 py-2 text-xs',
        className,
      )}
    >
      {STEPS.map((step) => {
        const stepIndex = STAGE_ORDER.indexOf(step.stage)
        const isComplete = currentIndex > stepIndex
        const isActive = currentIndex === stepIndex
        const Icon = step.icon

        return (
          <div
            key={step.stage}
            className={cn(
              'flex items-center gap-1.5',
              isComplete && 'text-success',
              isActive && 'text-primary',
              !isComplete && !isActive && 'text-muted-foreground',
            )}
          >
            {isActive ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Icon className="size-3.5" />
            )}
            <span className={cn(isActive && 'font-medium')}>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}
