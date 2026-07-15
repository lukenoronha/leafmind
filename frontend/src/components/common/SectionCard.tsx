import type { ReactNode } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Compact Card shell shared by the Profile and Settings pages — tighter
 * padding than the stock Card so both pages stay information-dense, with
 * a real `<h2>` for the section heading.
 */
export function SectionCard({
  title,
  description,
  action,
  className,
  titleClassName,
  children,
}: {
  title?: string
  description?: string
  /** Optional element rendered top-right of the header (e.g. a badge). */
  action?: ReactNode
  className?: string
  titleClassName?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-4 py-5 transition-shadow hover:shadow-md', className)}>
      {title ? (
        <CardHeader className="gap-0.5 px-5">
          <CardTitle className={cn('text-sm', titleClassName)}>
            <h2>{title}</h2>
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs">
              {description}
            </CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      {title ? <CardContent className="px-5">{children}</CardContent> : children}
    </Card>
  )
}
