import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BookMarked,
  Circle,
  History,
  Keyboard,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Pencil,
  Presentation,
  Settings,
  User as UserIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { ThemeSegmentedControl } from '@/components/user-hub/ThemeSegmentedControl'
import { KeyboardShortcutsDialog } from '@/components/user-hub/KeyboardShortcutsDialog'
import { useUserStats } from '@/hooks/use-user-stats'
import { usePresentationMode } from '@/hooks/use-presentation-mode'
import { ROUTES } from '@/routes/paths'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/types/auth'

function formatMemberSince(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface UserHubContentProps {
  user: AuthUser
  onNavigate: (to: string) => void
  onLogout: () => void
}

const fadeInUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

/**
 * The actual panel body — reused by both the desktop Popover (UserHub) and
 * the mobile bottom Sheet, so the two surfaces never drift out of sync.
 * Density is deliberate throughout (compact stat grid, 2-column actions,
 * single-row appearance/presentation controls) so the whole panel fits
 * without scrolling on first open, matching the reference apps' account
 * panels (ChatGPT/Claude/Cursor/Linear/Notion/GitHub Desktop) rather than
 * a full settings page condensed into a popover.
 */
export function UserHubContent({
  user,
  onNavigate,
  onLogout,
}: UserHubContentProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { stats, isLoading: statsLoading } = useUserStats()
  const { isPresentationMode, togglePresentationMode } = usePresentationMode()
  const prefersReducedMotion = useReducedMotion()
  const canTogglePresentationMode =
    user.role === 'developer' || user.role === 'admin'
  const memberSince = formatMemberSince(user.memberSince)

  const motionProps = prefersReducedMotion
    ? {}
    : {
        variants: fadeInUp,
        initial: 'hidden' as const,
        animate: 'show' as const,
      }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <motion.div {...motionProps} className="flex items-start gap-3">
        <Avatar size="lg" className="size-11 shrink-0">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback className="text-sm">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-foreground truncate text-sm font-bold">
              {user.name}
            </p>
            <span
              className="text-success inline-flex shrink-0 items-center"
              title="Online"
            >
              <Circle className="size-1.5 fill-current" aria-hidden="true" />
              <span className="sr-only">Online</span>
            </span>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {user.email}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={user.role} className="px-1.5 py-0 text-[0.65rem]" />
            <span className="text-muted-foreground text-[0.65rem]">
              {memberSince ? `Since ${memberSince}` : 'Since —'}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={() => onNavigate(ROUTES.user)}
          aria-label="Edit profile"
          title="Edit profile"
        >
          <Pencil className="size-3.5" />
        </Button>
      </motion.div>

      <Separator />

      {/* Activity — one compact grid, values or "—" inline, never a whole
       * card saying "Coming soon". Capped at 5 stats / 2 rows. */}
      <motion.div {...motionProps} className="space-y-1.5">
        <h3 className="text-muted-foreground text-[0.65rem] font-medium tracking-wide uppercase">
          Activity
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-muted/40 rounded-md px-2 py-1.5 text-center"
            >
              <p className="text-foreground text-base leading-tight font-semibold tabular-nums">
                {statsLoading ? (
                  <span className="bg-muted-foreground/20 mx-auto inline-block h-4 w-6 animate-pulse rounded" />
                ) : stat.available && stat.value !== null ? (
                  stat.label === 'Average Confidence' ? (
                    `${stat.value}%`
                  ) : (
                    stat.value
                  )
                ) : (
                  <span className="text-muted-foreground/60 text-sm">—</span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-[0.65rem] leading-tight">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <Separator />

      {/* Quick actions — 2-column grid of compact outlined buttons */}
      <motion.div {...motionProps} className="space-y-1.5">
        <h3 className="text-muted-foreground text-[0.65rem] font-medium tracking-wide uppercase">
          Quick actions
        </h3>
        <nav className="grid grid-cols-2 gap-1.5" aria-label="Quick actions">
          <HubActionButton
            icon={UserIcon}
            label="Profile"
            onClick={() => onNavigate(ROUTES.user)}
          />
          <HubActionButton
            icon={Settings}
            label="Settings"
            onClick={() => onNavigate(ROUTES.settings)}
          />
          <HubActionButton
            icon={History}
            label="History"
            onClick={() => onNavigate(ROUTES.history)}
          />
          <HubActionButton
            icon={BookMarked}
            label="Saved Reports"
            onClick={() => onNavigate(ROUTES.savedReports)}
          />
          <HubActionButton
            icon={MessageSquareText}
            label="Chat History"
            onClick={() => onNavigate(ROUTES.chatHistory)}
          />
          <HubActionButton
            icon={Keyboard}
            label="Shortcuts"
            onClick={() => setShortcutsOpen(true)}
          />
          <HubActionButton
            icon={LifeBuoy}
            label="Help"
            onClick={() => onNavigate(ROUTES.help)}
          />
        </nav>
      </motion.div>

      <Separator />

      {/* Appearance — compact segmented control, no section label needed
       * at this density (ChatGPT/GitHub-style model/theme picker). */}
      <motion.div {...motionProps}>
        <ThemeSegmentedControl />
      </motion.div>

      {/* Presentation mode — single row, dev/admin only */}
      {canTogglePresentationMode ? (
        <>
          <Separator />
          <motion.div
            {...motionProps}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Presentation
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-foreground text-xs font-medium">
                  Presentation Mode
                </p>
                <p className="text-muted-foreground truncate text-[0.65rem]">
                  Hides dev controls for demos.{' '}
                  <button
                    type="button"
                    className="hover:text-foreground underline decoration-dotted underline-offset-2 disabled:no-underline disabled:opacity-60"
                    disabled
                    title="Coming soon"
                  >
                    Learn more
                  </button>
                </p>
              </div>
            </div>
            <Switch
              size="sm"
              checked={isPresentationMode}
              onCheckedChange={togglePresentationMode}
              aria-label="Toggle presentation mode"
            />
          </motion.div>
        </>
      ) : null}

      <Separator />

      {/* Logout — danger styling, separated */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 justify-start px-2"
        onClick={onLogout}
      >
        <LogOut className="size-3.5" />
        Log out
      </Button>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}

function HubActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof UserIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-accent hover:border-accent-foreground/10 focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2',
      )}
    >
      <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-foreground truncate">{label}</span>
    </button>
  )
}
