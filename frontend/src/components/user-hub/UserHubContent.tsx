import { useState } from 'react'
import { toast } from 'sonner'
import {
  BookMarked,
  Circle,
  History,
  Keyboard,
  LifeBuoy,
  LogOut,
  MessageSquareText,
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
import type { AuthUser } from '@/types/auth'

function formatMemberSince(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
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

/**
 * The actual panel body — reused by both the desktop Popover (UserHubMenu)
 * and the mobile bottom Sheet, so the two surfaces never drift out of sync.
 */
export function UserHubContent({
  user,
  onNavigate,
  onLogout,
}: UserHubContentProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { stats, isLoading: statsLoading } = useUserStats()
  const { isPresentationMode, togglePresentationMode } = usePresentationMode()
  const canTogglePresentationMode =
    user.role === 'developer' || user.role === 'admin'
  const memberSince = formatMemberSince(user.memberSince)

  return (
    <div className="flex flex-col gap-5">
      {/* Section 1 — user information */}
      <div className="flex items-start gap-3">
        <Avatar size="lg" className="size-14">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback className="text-base">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground truncate text-sm font-semibold">
              {user.name}
            </p>
            <span className="text-success inline-flex items-center gap-1 text-xs">
              <Circle className="size-2 fill-current" aria-hidden="true" />
              Online
            </span>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {user.email}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <RoleBadge role={user.role} />
            {memberSince ? (
              <span className="text-muted-foreground text-xs">
                Member since {memberSince}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs italic">
                Member since — unavailable
              </span>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 2 — quick statistics */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Your activity
        </p>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-muted/50 rounded-lg border px-3 py-2"
            >
              <p className="text-foreground text-lg font-semibold tabular-nums">
                {statsLoading ? (
                  <span className="bg-muted-foreground/20 inline-block h-5 w-8 animate-pulse rounded-md" />
                ) : stat.available && stat.value !== null ? (
                  stat.label === 'Average Confidence' ? (
                    `${stat.value}%`
                  ) : (
                    stat.value
                  )
                ) : (
                  <span className="text-muted-foreground text-xs font-normal italic">
                    Coming soon
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Section 3 — quick actions */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Quick actions
        </p>
        <nav className="flex flex-col">
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
            icon={BookMarked}
            label="Saved Reports"
            onClick={() => onNavigate(ROUTES.savedReports)}
          />
          <HubActionButton
            icon={History}
            label="History"
            onClick={() => onNavigate(ROUTES.history)}
          />
          <HubActionButton
            icon={MessageSquareText}
            label="Chat History"
            onClick={() => onNavigate(ROUTES.chatHistory)}
          />
          <HubActionButton
            icon={Keyboard}
            label="Keyboard Shortcuts"
            onClick={() => setShortcutsOpen(true)}
          />
          <HubActionButton
            icon={LifeBuoy}
            label="Help & Feedback"
            onClick={() =>
              toast('Help & feedback', {
                description: 'Coming soon — no support channel is wired up yet.',
              })
            }
          />
        </nav>
      </div>

      <Separator />

      {/* Section 4 — appearance */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Appearance
        </p>
        <ThemeSegmentedControl />
      </div>

      {/* Section 5 — presentation mode */}
      {canTogglePresentationMode ? (
        <>
          <Separator />
          <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Presentation className="text-primary size-4" aria-hidden="true" />
                <p className="text-foreground text-sm font-medium">
                  Presentation Mode
                </p>
              </div>
              <Switch
                checked={isPresentationMode}
                onCheckedChange={togglePresentationMode}
                aria-label="Toggle presentation mode"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Hide developer controls, optimize spacing, and use larger
              typography for a cleaner interface — ideal for demos.
            </p>
          </div>
        </>
      ) : null}

      <Separator />

      {/* Section 7 — logout, danger styling, separated from the rest */}
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive justify-start"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
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
  shortcut,
  onClick,
}: {
  icon: typeof UserIcon
  label: string
  shortcut?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2"
    >
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <span className="text-foreground flex-1">{label}</span>
      {shortcut ? (
        <span className="text-muted-foreground text-xs tracking-widest">
          {shortcut}
        </span>
      ) : null}
    </button>
  )
}
