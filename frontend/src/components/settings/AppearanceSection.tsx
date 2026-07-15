import { LayoutGrid, Palette, Sparkles, SunMoon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ThemeSegmentedControl } from '@/components/user-hub/ThemeSegmentedControl'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { DisabledSelect } from '@/components/settings/DisabledSelect'
import { useMotionPreferences } from '@/hooks/use-motion-preferences'

/**
 * Theme and Animations are real (next-themes and the app-level
 * MotionPreferencesProvider). Accent color and density have no
 * persistence anywhere yet, so their dropdowns stay disabled showing the
 * app's genuine current values.
 */
export function AppearanceSection() {
  const { isMotionReduced, systemReducedMotion, setReduceMotionOverride } =
    useMotionPreferences()

  return (
    <SectionCard title="Appearance" description="How LeafMind looks and moves.">
      <div className="space-y-3">
        <SettingRow
          icon={SunMoon}
          title="Theme"
          description="Light, dark, or follow your system."
          control={
            <div className="w-full max-w-55 sm:w-55">
              <ThemeSegmentedControl />
            </div>
          }
        />
        <Separator />
        <SettingRow
          icon={Palette}
          title="Accent Color"
          description="The highlight color used across the app."
          comingSoon
          control={
            <DisabledSelect
              value="green"
              ariaLabel="Accent color"
              options={[{ value: 'green', label: 'Leaf green' }]}
            />
          }
        />
        <Separator />
        <SettingRow
          icon={LayoutGrid}
          title="Application Density"
          description="How much information fits on screen."
          comingSoon
          control={
            <DisabledSelect
              value="comfortable"
              ariaLabel="Application density"
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          }
        />
        <Separator />
        <SettingRow
          icon={Sparkles}
          title="Animations"
          description={
            systemReducedMotion
              ? 'Off — following your system’s reduced-motion setting.'
              : 'Interface transitions and motion effects.'
          }
          control={
            <Switch
              checked={!isMotionReduced}
              onCheckedChange={(checked) => setReduceMotionOverride(!checked)}
              disabled={systemReducedMotion}
              aria-label="Toggle interface animations"
            />
          }
        />
      </div>
    </SectionCard>
  )
}
