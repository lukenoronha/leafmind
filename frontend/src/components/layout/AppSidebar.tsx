import { NavLink } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Logo } from '@/components/common/Logo'
import { Badge } from '@/components/ui/badge'
import {
  filterNavItemsByRole,
  filterNavItemsForPresentation,
  primaryNavItems,
  secondaryNavItems,
} from '@/config/navigation'
import { useAuth } from '@/hooks/use-auth'
import { usePresentationMode } from '@/hooks/use-presentation-mode'

export function AppSidebar() {
  const { user } = useAuth()
  const { isPresentationMode } = usePresentationMode()
  const visiblePrimaryItems = filterNavItemsForPresentation(
    filterNavItemsByRole(primaryNavItems, user?.role),
    isPresentationMode,
  )
  const visibleSecondaryItems = filterNavItemsForPresentation(
    secondaryNavItems,
    isPresentationMode,
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Logo
            className="group-data-[collapsible=icon]:[&>span]:hidden"
            imgClassName="size-7"
            wordmarkClassName="text-sidebar-foreground"
          />
          {isPresentationMode ? (
            <Badge
              variant="secondary"
              className="group-data-[collapsible=icon]:hidden"
            >
              Demo
            </Badge>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimaryItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        isActive ? 'text-primary font-medium' : undefined
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {visibleSecondaryItems.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild tooltip={item.label}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'text-primary font-medium' : undefined
                  }
                >
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
