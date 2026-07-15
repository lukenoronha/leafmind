import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

/**
 * Account controls (avatar, profile, settings, presentation mode, logout)
 * live in the User Hub now — see components/user-hub/UserHub.tsx, reached
 * via the sidebar footer — so this bar is just the sidebar trigger.
 */
export function Navbar() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
    </header>
  )
}
