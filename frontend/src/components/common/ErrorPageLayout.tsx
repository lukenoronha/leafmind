import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/common/Logo'
import { cn } from '@/lib/utils'

interface ErrorPageLayoutProps {
  icon: LucideIcon
  iconClassName?: string
  title: string
  description: ReactNode
  actions: ReactNode
  className?: string
}

/**
 * Shared shell for the app's full-page error states (404, unauthorized,
 * session expired, route error) — keeps Logo presence, spacing, and heading
 * structure identical across all of them instead of each page reinventing
 * its own layout.
 */
export function ErrorPageLayout({
  icon: Icon,
  iconClassName,
  title,
  description,
  actions,
  className,
}: ErrorPageLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center',
        className,
      )}
    >
      <Logo />
      <div className="flex flex-col items-center gap-4">
        <Icon className={cn('text-muted-foreground size-10', iconClassName)} />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            {description}
          </p>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  )
}
