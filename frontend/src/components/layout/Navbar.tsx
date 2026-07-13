import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/routes/paths'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name ?? 'Guest'
  const displayEmail = user?.email ?? 'Not signed in'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleLogout() {
    await logout()
    toast.success('You have been signed out.')
    navigate(ROUTES.login, { replace: true })
  }

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ring-ring ml-1 rounded-full outline-none focus-visible:ring-2"
              aria-label="Open user menu"
            >
              <Avatar className="size-8">
                <AvatarImage src={user?.avatarUrl} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{displayName}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {displayEmail}
              </span>
              {user ? (
                <Badge variant="secondary" className="w-fit capitalize">
                  {user.role}
                </Badge>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(ROUTES.user)}>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(ROUTES.settings)}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
