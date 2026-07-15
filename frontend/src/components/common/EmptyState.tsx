import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = 'There is no data to display right now.',
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-foreground font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
