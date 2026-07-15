import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, BarChart3, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SectionCard } from '@/components/common/SectionCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { chatStorage } from '@/lib/chat-storage'

/**
 * LeafMind collects no analytics or diagnostics today, so those switches
 * are disabled (off). Clear Cache is real: it removes chat conversations
 * stored in this browser and drops the cached server data held by React
 * Query — except the signed-in session, so clearing never logs you out
 * or discards your preferences.
 */
export function PrivacySection() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleClearCache() {
    chatStorage.clearAll()
    // Keep the ['auth', ...] scope so the current-user query (and with it
    // the session) survives; everything else refetches on demand.
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    })
    setConfirmOpen(false)
    toast.success('Cache cleared.')
  }

  return (
    <SectionCard title="Privacy" description="Your data on this device.">
      <div className="space-y-3">
        <SettingRow
          icon={BarChart3}
          title="Analytics"
          description="LeafMind doesn't collect analytics."
          comingSoon
          control={<Switch disabled aria-label="Analytics (coming soon)" />}
        />
        <Separator />
        <SettingRow
          icon={Activity}
          title="Usage Diagnostics"
          description="Share crash and performance reports."
          comingSoon
          control={
            <Switch disabled aria-label="Usage diagnostics (coming soon)" />
          }
        />
        <Separator />
        <SettingRow
          icon={Trash2}
          title="Clear Cache"
          description="Remove chat conversations stored in this browser and cached server data. You stay signed in."
          control={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              Clear cache
            </Button>
          }
        />
      </div>

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear cached data?"
        description="Chat conversations saved in this browser will be permanently removed, and cached server data (history, reports) will be refetched. You will stay signed in and your preferences are kept."
        confirmLabel="Clear cache"
        confirmPendingLabel="Clearing..."
        onConfirm={handleClearCache}
      />
    </SectionCard>
  )
}
