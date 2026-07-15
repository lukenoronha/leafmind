import { useState } from 'react'
import { Ban, Trash2, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { UserProfileSheet } from '@/components/admin/users/UserProfileSheet'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import {
  useAdminUsers,
  useDeleteUser,
  useHardDeleteUser,
  useSetUserStatus,
} from '@/hooks/use-admin-users'
import type { AccountStatus, AdminUser } from '@/types/admin'
import type { UserRole } from '@/types/auth'

const ROLE_OPTIONS: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: 'user', label: 'User' },
  { value: 'developer', label: 'Developer' },
  { value: 'admin', label: 'Admin' },
]

const STATUS_OPTIONS: { value: AccountStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function UserManagementPanel() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [status, setStatus] = useState<AccountStatus | 'all'>('all')
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null)
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(
    null,
  )
  const [pendingHardDeleteId, setPendingHardDeleteId] = useState<string | null>(
    null,
  )

  const { data, isLoading, isError, refetch } = useAdminUsers({
    search: search.trim() || undefined,
    role: role === 'all' ? undefined : role,
    status: status === 'all' ? undefined : status,
  })

  const setUserStatus = useSetUserStatus()
  const deleteUser = useDeleteUser()
  const hardDeleteUser = useHardDeleteUser()

  function handleConfirmDeactivate() {
    if (!pendingDeactivateId) return
    deleteUser.mutate(pendingDeactivateId, {
      onSuccess: () => setPendingDeactivateId(null),
    })
  }

  function handleConfirmHardDelete() {
    if (!pendingHardDeleteId) return
    hardDeleteUser.mutate(pendingHardDeleteId, {
      onSuccess: () => setPendingHardDeleteId(null),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User management</CardTitle>
        <CardDescription>
          Search, filter, and manage LeafMind accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:flex-1"
          />
          <Select
            value={role}
            onValueChange={(value) => setRole(value as UserRole | 'all')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as AccountStatus | 'all')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load users"
            description="We couldn't reach the user management endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching users"
            description="Try a different search term or filter."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setProfileUser(user)}
                      className="flex items-center gap-2 text-left"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-foreground font-medium">
                          {user.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {user.email}
                        </p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.status === 'active'}
                      disabled={setUserStatus.isPending}
                      aria-label={
                        user.status === 'active'
                          ? `Deactivate ${user.name}`
                          : `Activate ${user.name}`
                      }
                      onCheckedChange={(checked) =>
                        setUserStatus.mutate({
                          userId: user.id,
                          status: checked ? 'active' : 'inactive',
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDeactivateId(user.id)}
                        aria-label={`Deactivate ${user.name}`}
                        title="Deactivate (revokes access, keeps history)"
                      >
                        <Ban className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingHardDeleteId(user.id)}
                        aria-label={`Permanently delete ${user.name}`}
                        title="Permanently delete (irreversible)"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UserProfileSheet
        user={profileUser}
        open={!!profileUser}
        onOpenChange={(open) => !open && setProfileUser(null)}
      />

      <DeleteConfirmDialog
        open={!!pendingDeactivateId}
        onOpenChange={(open) => !open && setPendingDeactivateId(null)}
        title="Deactivate this user?"
        description="This revokes their access to LeafMind and signs them out everywhere. Their prediction and chat history is preserved, not deleted — you can reactivate the account later from this page."
        confirmLabel="Deactivate"
        confirmPendingLabel="Deactivating..."
        onConfirm={handleConfirmDeactivate}
        isPending={deleteUser.isPending}
      />

      <DeleteConfirmDialog
        open={!!pendingHardDeleteId}
        onOpenChange={(open) => !open && setPendingHardDeleteId(null)}
        title="Permanently delete this user?"
        description="This permanently removes the account and every prediction, chat message, and document associated with it. This cannot be undone. If you only want to revoke access, use Deactivate instead."
        onConfirm={handleConfirmHardDelete}
        isPending={hardDeleteUser.isPending}
      />
    </Card>
  )
}
