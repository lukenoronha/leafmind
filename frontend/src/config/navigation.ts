import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  History,
  LayoutDashboard,
  Sparkles,
  Settings,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'
import { ROUTES } from '@/routes/paths'
import type { UserRole } from '@/types/auth'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Omit to show the item to every authenticated role. */
  roles?: UserRole[]
  /** Hidden while Presentation Mode is active, e.g. admin/dev tooling. */
  hideInPresentationMode?: boolean
}

/**
 * Account and Chat History deliberately dropped from primary nav — Account
 * management moved into the User Hub (sidebar footer), and Chat History
 * duplicated History from the user's perspective (both are per-analysis
 * conversation lists; Chat History is now reachable as a User Hub quick
 * action instead of a top-level nav slot). Route + page still exist.
 */
export const primaryNavItems: NavItem[] = [
  { label: 'New Analysis', to: ROUTES.home, icon: Sparkles },
  { label: 'History', to: ROUTES.history, icon: History },
  { label: 'Saved Reports', to: ROUTES.savedReports, icon: BookMarked },
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  {
    label: 'Developer',
    to: ROUTES.developer,
    icon: TerminalSquare,
    roles: ['developer', 'admin'],
    hideInPresentationMode: true,
  },
  {
    label: 'Admin',
    to: ROUTES.admin,
    icon: ShieldCheck,
    roles: ['admin'],
    hideInPresentationMode: true,
  },
]

export const secondaryNavItems: NavItem[] = [
  { label: 'Settings', to: ROUTES.settings, icon: Settings },
]

export function filterNavItemsByRole(items: NavItem[], role?: UserRole) {
  return items.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  )
}

export function filterNavItemsForPresentation(
  items: NavItem[],
  isPresentationMode: boolean,
) {
  if (!isPresentationMode) return items
  return items.filter((item) => !item.hideInPresentationMode)
}
