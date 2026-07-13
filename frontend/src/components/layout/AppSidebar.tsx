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
import {
  filterNavItemsByRole,
  primaryNavItems,
  secondaryNavItems,
} from '@/config/navigation'
import { useAuth } from '@/hooks/use-auth'

export function AppSidebar() {
  const { user } = useAuth()
  const visiblePrimaryItems = filterNavItemsByRole(primaryNavItems, user?.role)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Logo
            className="group-data-[collapsible=icon]:[&>span]:hidden"
            imgClassName="size-7"
            wordmarkClassName="text-sidebar-foreground"
          />
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
          {secondaryNavItems.map((item) => (
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
