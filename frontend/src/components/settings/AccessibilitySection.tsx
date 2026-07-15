import { useState } from 'react'
import {
  Contrast,
  Keyboard,
  Presentation,
  Type,
  ZapOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { KeyboardShortcutsDialog } from '@/components/user-hub/KeyboardShortcutsDialog'
import { useMotionPreferences } from '@/hooks/use-motion-preferences'
import { usePresentationMode } from '@/hooks/use-presentation-mode'
import type { AuthUser } from '@/types/auth'

/**
 * Presentation Mode (existing provider, dev/admin only — same gating as
 * the User Hub) and Reduced Motion (MotionPreferencesProvider) are real;
 * high contrast and large text have no implementation yet. Keyboard
 * shortcuts opens the existing dialog.
 */
export function AccessibilitySection({ user }: { user: AuthUser }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { isPresentationMode, togglePresentationMode } = usePresentationMode()
  const {
    isMotionReduced,
    systemReducedMotion,
    setReduceMotionOverride,
  } = useMotionPreferences()
  const canTogglePresentationMode =
    user.role === 'developer' || user.role === 'admin'

  return (
    <SectionCard
      title="Accessibility"
      description="Make LeafMind easier to see and use."
    >
      <div className="space-y-3">
        {canTogglePresentationMode ? (
          <>
            <SettingRow
              icon={Presentation}
              title="Presentation Mode"
              description="Hides developer controls for demos."
              control={
                <Switch
                  checked={isPresentationMode}
                  onCheckedChange={togglePresentationMode}
                  aria-label="Toggle presentation mode"
                />
              }
            />
            <Separator />
          </>
        ) : null}
        <SettingRow
          icon={Contrast}
          title="High Contrast"
          description="Stronger borders and text contrast."
          comingSoon
          control={<Switch disabled aria-label="High contrast (coming soon)" />}
        />
        <Separator />
        <SettingRow
          icon={ZapOff}
          title="Reduced Motion"
          description={
            systemReducedMotion
              ? 'On — following your system’s reduced-motion setting.'
              : 'Minimize interface animations.'
          }
          control={
            <Switch
              checked={isMotionReduced}
              onCheckedChange={setReduceMotionOverride}
              disabled={systemReducedMotion}
              aria-label="Toggle reduced motion"
            />
          }
        />
        <Separator />
        <SettingRow
          icon={Type}
          title="Large Text"
          description="Increase the interface font size."
          comingSoon
          control={<Switch disabled aria-label="Large text (coming soon)" />}
        />
        <Separator />
        <SettingRow
          icon={Keyboard}
          title="Keyboard Shortcuts"
          description="Move around LeafMind faster."
          control={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShortcutsOpen(true)}
            >
              View shortcuts
            </Button>
          }
        />
      </div>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </SectionCard>
  )
}
