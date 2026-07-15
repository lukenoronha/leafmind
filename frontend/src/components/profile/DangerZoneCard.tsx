import { LogOut, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ComingSoonBadge } from '@/components/common/ComingSoonBadge'

/**
 * Danger zone. Logout is real; account deletion has no backend endpoint
 * and must stay disabled rather than pretend to work.
 */
export function DangerZoneCard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <LogOut
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">Sign out</p>
            <p className="text-muted-foreground text-xs">
              Sign out of LeafMind on this device.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
          onClick={onLogout}
        >
          Sign out
        </Button>
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Trash2
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
              Delete account
              <ComingSoonBadge />
            </p>
            <p className="text-muted-foreground text-xs">
              Permanently delete your account and all associated data.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="shrink-0"
          disabled
          title="Available after backend integration"
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
