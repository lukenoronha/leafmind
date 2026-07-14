import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { AdminUser } from '@/types/admin'

interface UserProfileSheetProps {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function UserProfileSheet({
  user,
  open,
  onOpenChange,
}: UserProfileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {user ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle>{user.name}</SheetTitle>
                  <SheetDescription>{user.email}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4 px-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
                <Badge
                  variant={user.status === 'active' ? 'default' : 'outline'}
                  className="capitalize"
                >
                  {user.status}
                </Badge>
              </div>

              <Separator />

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Joined</dt>
                  <dd className="text-foreground font-medium">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
