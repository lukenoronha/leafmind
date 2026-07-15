import { useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ComingSoonBadge } from '@/components/common/ComingSoonBadge'
import { useUpdateProfile } from '@/hooks/use-profile'
import { getApiErrorMessage } from '@/lib/api-error'
import type { AuthUser } from '@/types/auth'

interface ProfileInformationCardProps {
  user: AuthUser
  /** Owned by UserPage so the summary card's "Edit profile" can focus it. */
  nameInputRef: RefObject<HTMLInputElement | null>
}

/**
 * Compact editable profile form. Only `name` is genuinely editable —
 * PATCH /auth/me supports nothing else — so every other field is either
 * read-only (email) or disabled with a "Coming soon" marker (institution,
 * department, country, timezone, bio have no backend columns yet).
 */
export function ProfileInformationCard({
  user,
  nameInputRef,
}: ProfileInformationCardProps) {
  const [name, setName] = useState(user.name)
  const updateProfile = useUpdateProfile()

  // Re-sync if the cached user changes underneath us (save success,
  // refetch) — the render-time reset pattern from the React docs, instead
  // of a cascading setState-in-effect.
  const [syncedName, setSyncedName] = useState(user.name)
  if (syncedName !== user.name) {
    setSyncedName(user.name)
    setName(user.name)
  }

  const trimmedName = name.trim()
  const isDirty = trimmedName !== user.name
  const canSave = isDirty && trimmedName.length > 0 && !updateProfile.isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    updateProfile.mutate(
      { name: trimmedName },
      {
        onSuccess: () => toast.success('Profile updated.'),
        onError: (error) =>
          toast.error(getApiErrorMessage(error, 'Unable to update profile.')),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Profile information">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={150}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={user.email}
            readOnly
            aria-readonly="true"
            className="text-muted-foreground bg-muted/40 cursor-default focus-visible:ring-0"
            title="Email changes aren't supported yet"
          />
        </div>

        <DisabledField id="profile-institution" label="Institution" />
        <DisabledField id="profile-department" label="Department" />
        <DisabledField id="profile-country" label="Country" optional />
        <DisabledField id="profile-timezone" label="Timezone" optional />

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="profile-bio" className="text-muted-foreground">
            Bio
            <span className="text-muted-foreground/70 font-normal">
              (optional)
            </span>
            <ComingSoonBadge />
          </Label>
          <Textarea
            id="profile-bio"
            disabled
            rows={2}
            placeholder="Available after backend integration"
            className="resize-none"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {isDirty ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setName(user.name)}
            disabled={updateProfile.isPending}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!canSave}>
          {updateProfile.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}

function DisabledField({
  id,
  label,
  optional = false,
}: {
  id: string
  label: string
  optional?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
        {optional ? (
          <span className="text-muted-foreground/70 font-normal">
            (optional)
          </span>
        ) : null}
        <ComingSoonBadge />
      </Label>
      <Input
        id={id}
        disabled
        placeholder="Available after backend integration"
      />
    </div>
  )
}
