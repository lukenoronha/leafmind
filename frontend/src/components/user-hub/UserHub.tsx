import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { UserHubContent } from '@/components/user-hub/UserHubContent'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-mobile'
import { ROUTES } from '@/routes/paths'

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Sidebar-footer entry point into the User Hub — the redesigned account
 * panel that replaces the old Navbar avatar dropdown. Renders as an
 * anchored Popover on desktop/tablet and as a bottom Sheet on mobile, both
 * driven by the same UserHubContent so the two surfaces can't drift apart.
 */
export function UserHub() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { state: sidebarState } = useSidebar()
  const [open, setOpen] = useState(false)

  if (!user) return null

  function handleNavigate(to: string) {
    setOpen(false)
    navigate(to)
  }

  async function handleLogout() {
    setOpen(false)
    await logout()
    toast.success('You have been signed out.')
    navigate(ROUTES.login, { replace: true })
  }

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      data-state={open ? 'open' : 'closed'}
      tooltip={user.name}
    >
      <Avatar className="size-7">
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback className="text-xs">
          {initialsOf(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <span className="text-sidebar-foreground truncate text-sm font-medium">
          {user.name}
        </span>
        <RoleBadge
          role={user.role}
          showIcon={false}
          className="w-fit border-none bg-transparent px-0 py-0 text-[0.65rem] font-normal capitalize opacity-70"
        />
      </div>
      <ChevronsUpDown className="text-sidebar-foreground/50 ml-auto size-4 shrink-0" />
    </SidebarMenuButton>
  )

  if (isMobile) {
    return (
      <SidebarMenuItem>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85svh] overflow-y-auto rounded-t-2xl"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Account</SheetTitle>
            </SheetHeader>
            <div className="px-3 pb-3">
              <UserHubContent
                user={user}
                onNavigate={handleNavigate}
                onLogout={() => void handleLogout()}
              />
            </div>
          </SheetContent>
        </Sheet>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side={sidebarState === 'collapsed' ? 'right' : 'top'}
          align="start"
          className="max-h-[85svh] w-80 overflow-y-auto p-3"
        >
          <UserHubContent
            user={user}
            onNavigate={handleNavigate}
            onLogout={() => void handleLogout()}
          />
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  )
}
