import { Bell, BellRing, BookOpen, Mail } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'

/**
 * No notification delivery exists anywhere in the stack (no email sender
 * for notifications, no web-push, no per-user preference storage), so the
 * whole section is disabled.
 */
export function NotificationsSection() {
  return (
    <SectionCard
      title="Notifications"
      description="When LeafMind should reach out."
    >
      <div className="space-y-3">
        <SettingRow
          icon={Mail}
          title="Email Notifications"
          description="Summaries and important account activity."
          comingSoon
          control={
            <Switch disabled aria-label="Email notifications (coming soon)" />
          }
        />
        <Separator />
        <SettingRow
          icon={Bell}
          title="Desktop Notifications"
          description="Browser notifications from LeafMind."
          comingSoon
          control={
            <Switch
              disabled
              aria-label="Desktop notifications (coming soon)"
            />
          }
        />
        <Separator />
        <SettingRow
          icon={BellRing}
          title="Prediction Complete"
          description="Notify when a long-running identification finishes."
          comingSoon
          control={
            <Switch
              disabled
              aria-label="Prediction complete notifications (coming soon)"
            />
          }
        />
        <Separator />
        <SettingRow
          icon={BookOpen}
          title="Knowledge Base Updates"
          description="Notify when new plant documents are added."
          comingSoon
          control={
            <Switch
              disabled
              aria-label="Knowledge base update notifications (coming soon)"
            />
          }
        />
      </div>
    </SectionCard>
  )
}
