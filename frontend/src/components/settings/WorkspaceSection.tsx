import { Home, PanelLeftClose, RotateCcw, Save } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { DisabledSelect } from '@/components/settings/DisabledSelect'

/**
 * Every workspace preference needs backend persistence that doesn't exist
 * yet, so all four controls are disabled. The landing-page dropdown shows
 * "New Analysis" because that is genuinely where the app lands today ("/").
 */
export function WorkspaceSection() {
  return (
    <SectionCard title="Workspace" description="Defaults for how you work.">
      <div className="space-y-3">
        <SettingRow
          icon={Home}
          title="Default Landing Page"
          description="Where LeafMind opens after sign-in."
          comingSoon
          control={
            <DisabledSelect
              value="analysis"
              ariaLabel="Default landing page"
              options={[
                { value: 'analysis', label: 'New Analysis' },
                { value: 'history', label: 'History' },
                { value: 'dashboard', label: 'Dashboard' },
              ]}
            />
          }
        />
        <Separator />
        <SettingRow
          icon={Save}
          title="Auto Save Reports"
          description="Save every identification report automatically."
          comingSoon
          control={
            <Switch disabled aria-label="Auto save reports (coming soon)" />
          }
        />
        <Separator />
        <SettingRow
          icon={RotateCcw}
          title="Remember Last Session"
          description="Restore your last analysis when you return."
          comingSoon
          control={
            <Switch
              disabled
              aria-label="Remember last session (coming soon)"
            />
          }
        />
        <Separator />
        <SettingRow
          icon={PanelLeftClose}
          title="Sidebar"
          description="Collapse the sidebar automatically on small screens."
          comingSoon
          control={
            <Switch
              disabled
              aria-label="Collapse sidebar automatically (coming soon)"
            />
          }
        />
      </div>
    </SectionCard>
  )
}
