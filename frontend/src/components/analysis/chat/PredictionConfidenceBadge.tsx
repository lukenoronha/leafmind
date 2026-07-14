import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  TriangleAlert,
} from 'lucide-react'
import { getConfidenceTier, type ConfidenceTier } from '@/lib/confidence'
import { cn } from '@/lib/utils'

const TIER_CONFIG: Record<
  ConfidenceTier,
  { label: string; icon: typeof CircleCheck; className: string }
> = {
  high: {
    label: 'match',
    icon: CircleCheck,
    className: 'bg-success/15 text-success border-success/30',
  },
  medium: {
    label: 'likely match',
    icon: CircleHelp,
    className: 'bg-warning/15 text-warning border-warning/30',
  },
  low: {
    label: 'uncertain',
    icon: TriangleAlert,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  'very-low': {
    label: 'low confidence',
    icon: CircleAlert,
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
}

interface PredictionConfidenceBadgeProps {
  /** 0-1 fraction. */
  value: number
  className?: string
}

export function PredictionConfidenceBadge({
  value,
  className,
}: PredictionConfidenceBadgeProps) {
  const tier = getConfidenceTier(value)
  const { label, icon: Icon, className: tierClassName } = TIER_CONFIG[tier]
  const percent = Math.round(value * 100)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        tierClassName,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {percent}% {label}
    </span>
  )
}
