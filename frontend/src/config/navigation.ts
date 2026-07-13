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

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export const primaryNavItems: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Identify', to: ROUTES.home, icon: Leaf },
  { label: 'Account', to: ROUTES.user, icon: User },
  { label: 'Developer', to: ROUTES.developer, icon: TerminalSquare },
  { label: 'Admin', to: ROUTES.admin, icon: ShieldCheck },
]

export const secondaryNavItems: NavItem[] = [
  { label: 'Settings', to: ROUTES.settings, icon: Settings },
]
