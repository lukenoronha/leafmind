import { GraduationCap, ShieldCheck, TerminalSquare, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Keyed by plain string rather than `UserRole` — the app's own type only
 * models 'user' | 'developer' | 'admin' today, but this also styles
 * 'researcher' / 'student' in case the backend's role table grows to
 * include them later, falling back to a neutral treatment for anything
 * else unrecognized.
 */
const ROLE_STYLES: Record<
  string,
  { label: string; icon: LucideIcon; className: string }
> = {
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    className:
      'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  developer: {
    label: 'Developer',
    icon: TerminalSquare,
    className:
      'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  },
  researcher: {
    label: 'Researcher',
    icon: GraduationCap,
    className:
      'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  },
  student: {
    label: 'Student',
    icon: GraduationCap,
    className:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  user: {
    label: 'User',
    icon: User,
    className:
      'bg-muted text-muted-foreground border-border',
  },
}

interface RoleBadgeProps {
  role: string
  className?: string
  showIcon?: boolean
}

export function RoleBadge({ role, className, showIcon = true }: RoleBadgeProps) {
  const style = ROLE_STYLES[role.toLowerCase()] ?? {
    label: role,
    icon: User,
    className: 'bg-muted text-muted-foreground border-border',
  }
  const Icon = style.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        style.className,
        className,
      )}
    >
      {showIcon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {style.label}
    </span>
  )
}
