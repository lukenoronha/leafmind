import { Bell, Globe, Palette, Presentation } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ThemeSegmentedControl } from '@/components/user-hub/ThemeSegmentedControl'
import { ComingSoonBadge } from '@/components/profile/ComingSoonBadge'
import { usePresentationMode } from '@/hooks/use-presentation-mode'
import type { AuthUser } from '@/types/auth'

/**
 * Preferences section. Theme and Presentation Mode are real (theme is
 * client-side via next-themes; presentation mode is the existing
 * dev/admin-only toggle). Language and notifications have no backend, so
 * their controls stay disabled.
 */
export function PreferencesCard({ user }: { user: AuthUser }) {
  const { isPresentationMode, togglePresentationMode } = usePresentationMode()
  const canTogglePresentationMode =
    user.role === 'developer' || user.role === 'admin'

  return (
    <div className="space-y-3">
      <PreferenceRow
        icon={Palette}
        title="Theme"
        description="How LeafMind looks on this device."
        control={
          <div className="w-full max-w-55 sm:w-55">
            <ThemeSegmentedControl />
          </div>
        }
      />
      <Separator />
      <PreferenceRow
        icon={Globe}
        title="Language"
        description="English is the only language for now."
        comingSoon
        control={
          <Switch
            size="sm"
            disabled
            aria-label="Language selection (coming soon)"
          />
        }
      />
      <Separator />
      <PreferenceRow
        icon={Bell}
        title="Notifications"
        description="Email and in-app notification preferences."
        comingSoon
        control={
          <Switch
            size="sm"
            disabled
            aria-label="Notification preferences (coming soon)"
          />
        }
      />
      {canTogglePresentationMode ? (
        <>
          <Separator />
          <PreferenceRow
            icon={Presentation}
            title="Presentation Mode"
            description="Hides dev controls for demos."
            control={
              <Switch
                size="sm"
                checked={isPresentationMode}
                onCheckedChange={togglePresentationMode}
                aria-label="Toggle presentation mode"
              />
            }
          />
        </>
      ) : null}
    </div>
  )
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  control,
  comingSoon = false,
}: {
  icon: typeof Palette
  title: string
  description: string
  control: React.ReactNode
  comingSoon?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
            {title}
            {comingSoon ? <ComingSoonBadge /> : null}
          </p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
