import type { LucideIcon } from 'lucide-react'
import { ComingSoonBadge } from '@/components/common/ComingSoonBadge'
import { cn } from '@/lib/utils'

/**
 * One compact setting: icon, title, description on the left, control on
 * the right (Cursor/GitHub/Notion row pattern). On narrow screens the
 * control wraps below the text instead of overflowing.
 */
export function SettingRow({
  icon: Icon,
  title,
  description,
  control,
  comingSoon = false,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  control: React.ReactNode
  comingSoon?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-2.5">
        <Icon
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-foreground flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {title}
            {comingSoon ? <ComingSoonBadge /> : null}
          </p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 items-center">{control}</div>
    </div>
  )
}
