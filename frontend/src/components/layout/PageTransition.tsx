import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Replays a subtle fade/slide-in on every route change. Keying on the
 * pathname forces React to remount this wrapper (not its children's
 * internal state, since the routed page itself unmounts/remounts
 * anyway on navigation) so the tw-animate-css classes re-trigger.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div
      key={location.pathname}
      className="animate-in fade-in slide-in-from-bottom-1 duration-300"
    >
      {children}
    </div>
  )
}
