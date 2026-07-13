import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Leaf,
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
}

export const primaryNavItems: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Identify', to: ROUTES.home, icon: Leaf },
  { label: 'Account', to: ROUTES.user, icon: User },
  {
    label: 'Developer',
    to: ROUTES.developer,
    icon: TerminalSquare,
    roles: ['developer', 'admin'],
  },
  { label: 'Admin', to: ROUTES.admin, icon: ShieldCheck, roles: ['admin'] },
]

export const secondaryNavItems: NavItem[] = [
  { label: 'Settings', to: ROUTES.settings, icon: Settings },
]

export function filterNavItemsByRole(items: NavItem[], role?: UserRole) {
  return items.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  )
}
