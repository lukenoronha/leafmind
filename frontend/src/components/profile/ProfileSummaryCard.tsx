import { useRef } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2, Mail, Pencil, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { useUploadAvatar } from '@/hooks/use-profile'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AuthUser } from '@/types/auth'

// Mirrors the backend's avatar constraints (ALLOWED_AVATAR_CONTENT_TYPES /
// MAX_AVATAR_UPLOAD_SIZE_MB in backend/app/core/config.py) so obviously
// invalid files fail fast with a friendly message instead of a 4xx.
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatMemberSince(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ProfileSummaryCardProps {
  user: AuthUser
  /** Focuses the name field in the Profile Information form. */
  onEditProfile: () => void
}

/**
 * Left-column identity card: large avatar with online indicator, name,
 * role badge, email, member-since, plus the account-information rows.
 * Avatar upload is real (POST /auth/me/avatar); "Last login" is not
 * tracked by the backend, so it renders an honest em-dash rather than a
 * fabricated timestamp.
 */
export function ProfileSummaryCard({
  user,
  onEditProfile,
}: ProfileSummaryCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAvatar = useUploadAvatar()
  const memberSince = formatMemberSince(user.memberSince)

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so re-selecting the same file fires onChange again.
    event.target.value = ''
    if (!file) return

    if (!AVATAR_ACCEPT.split(',').includes(file.type)) {
      toast.error('Avatar must be a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Avatar must be 5 MB or smaller.')
      return
    }

    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success('Avatar updated.'),
      onError: (error) =>
        toast.error(getApiErrorMessage(error, 'Unable to upload avatar.')),
    })
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <Avatar className="size-20 text-xl">
          <AvatarImage src={user.avatarUrl} alt="" />
          <AvatarFallback className="text-xl font-medium">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className="border-card bg-success absolute right-0.5 bottom-0.5 block size-3.5 rounded-full border-2"
          title="Online"
        >
          <span className="sr-only">Online</span>
        </span>
      </div>

      <h2 className="text-foreground mt-3 text-base leading-tight font-semibold">
        {user.name}
      </h2>
      <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
        <Mail className="size-3" aria-hidden="true" />
        <span className="truncate">{user.email}</span>
      </p>
      <div className="mt-2">
        <RoleBadge role={user.role} />
      </div>

      <div className="mt-4 flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onEditProfile}
        >
          <Pencil className="size-3.5" />
          Edit profile
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAvatar.isPending}
        >
          {uploadAvatar.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-3.5" aria-hidden="true" />
          )}
          {uploadAvatar.isPending ? 'Uploading…' : 'Change avatar'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="sr-only"
          aria-label="Upload a new avatar image"
          onChange={handleFileSelected}
          tabIndex={-1}
        />
      </div>

      <Separator className="my-4" />

      {/* Account information — read-only facts from GET /auth/me. */}
      <dl className="w-full space-y-2.5 text-left">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">Member since</dt>
          <dd className="text-foreground text-xs font-medium">
            {memberSince ?? '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">Account role</dt>
          <dd className="text-foreground text-xs font-medium capitalize">
            {user.role}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">Authentication</dt>
          <dd className="text-foreground flex items-center gap-1 text-xs font-medium">
            <ShieldCheck className="text-muted-foreground size-3" aria-hidden="true" />
            Email &amp; password
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">Last login</dt>
          {/* Not stored by the backend yet — never fabricate a timestamp. */}
          <dd
            className="text-muted-foreground/70 text-xs"
            title="Not tracked by the backend yet"
          >
            —
          </dd>
        </div>
      </dl>
    </div>
  )
}
