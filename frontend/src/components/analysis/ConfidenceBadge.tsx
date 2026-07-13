import { Gauge } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  /** Confidence as a 0-1 fraction. */
  value: number
  label?: string
  className?: string
}

function confidenceVariant(value: number) {
  if (value >= 0.85) return 'default'
  if (value >= 0.6) return 'secondary'
  return 'destructive'
}

export function ConfidenceBadge({
  value,
  label,
  className,
}: ConfidenceBadgeProps) {
  const percent = Math.round(value * 100)

  return (
    <Badge variant={confidenceVariant(value)} className={cn(className)}>
      <Gauge />
      {label ? `${label} ${percent}%` : `${percent}%`}
    </Badge>
  )
}
