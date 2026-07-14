import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  History,
  LayoutDashboard,
  MessageSquareText,
  Sparkles,
  Settings,
  ShieldCheck,
  TerminalSquare,
  User,
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

export const primaryNavItems: NavItem[] = [
  { label: 'New Analysis', to: ROUTES.home, icon: Sparkles },
  { label: 'History', to: ROUTES.history, icon: History },
  { label: 'Saved Reports', to: ROUTES.savedReports, icon: BookMarked },
  { label: 'Chat History', to: ROUTES.chatHistory, icon: MessageSquareText },
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Account', to: ROUTES.user, icon: User },
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
