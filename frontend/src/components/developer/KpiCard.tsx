import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { KpiMetric } from '@/types/developer'
import { cn } from '@/lib/utils'

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const

const TREND_COLOR = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
} as const

interface KpiCardProps {
  metric: KpiMetric
  icon: LucideIcon
  className?: string
}

export function KpiCard({ metric, icon: Icon, className }: KpiCardProps) {
  const TrendIcon = metric.trend ? TREND_ICON[metric.trend] : null

  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-sm">{metric.label}</p>
          <p className="text-foreground text-2xl font-semibold tracking-tight">
            {metric.value}
          </p>
          {metric.changeLabel && TrendIcon ? (
            <p
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                TREND_COLOR[metric.trend ?? 'flat'],
              )}
            >
              <TrendIcon className="size-3.5" />
              {metric.changeLabel}
            </p>
          ) : null}
        </div>
        <div className="bg-accent text-primary rounded-lg p-2">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
