import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  metric: { id: string; label: string; value: string }
  icon: LucideIcon
  className?: string
}

export function KpiCard({ metric, icon: Icon, className }: KpiCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-sm">{metric.label}</p>
          <p className="text-foreground text-2xl font-semibold tracking-tight">
            {metric.value}
          </p>
        </div>
        <div className="bg-accent text-primary rounded-lg p-2">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
