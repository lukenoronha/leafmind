import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Thin banner shown when the browser reports it has lost network
 * connectivity. This only detects local connectivity (navigator.onLine
 * + online/offline events) — backend-down-but-network-up failures are
 * surfaced per-request via toasts from api-client.ts instead, since
 * there's no reliable way to globally detect "the API is unreachable"
 * without polling.
 */
export function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  )

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      className="bg-destructive text-destructive-foreground flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium"
    >
      <WifiOff className="size-4" />
      You&apos;re offline. Some features may not work until your connection is
      restored.
    </div>
  )
}
