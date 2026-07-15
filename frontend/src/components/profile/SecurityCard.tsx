import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { KeyRound, Loader2, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ComingSoonBadge } from '@/components/common/ComingSoonBadge'
import { useChangePassword } from '@/hooks/use-profile'
import { useAuth } from '@/hooks/use-auth'
import { getApiErrorMessage } from '@/lib/api-error'
import { ROUTES } from '@/routes/paths'

/**
 * Security section. Change Password (PUT /auth/change-password) and Forgot
 * Password (the existing /forgot-password flow) are real; Sessions and 2FA
 * have no backend support yet and stay disabled.
 */
export function SecurityCard() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="space-y-3">
      <SecurityRow
        icon={KeyRound}
        title="Password"
        description="Change your password. Other sessions are signed out."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            Change password
          </Button>
        }
      />
      <Separator />
      <SecurityRow
        icon={KeyRound}
        title="Forgot password"
        description="Get a single-use reset link by email."
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.forgotPassword)}
          >
            Send reset link
          </Button>
        }
      />
      <Separator />
      <SecurityRow
        icon={MonitorSmartphone}
        title="Sessions"
        description="Review and revoke devices signed in to your account."
        comingSoon
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Available after backend integration"
          >
            Manage
          </Button>
        }
      />
      <Separator />
      <SecurityRow
        icon={ShieldCheck}
        title="Two-factor authentication"
        description="Add a second step when signing in."
        comingSoon
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Available after backend integration"
          >
            Enable
          </Button>
        }
      />

      <ChangePasswordDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function SecurityRow({
  icon: Icon,
  title,
  description,
  action,
  comingSoon = false,
}: {
  icon: typeof KeyRound
  title: string
  description: string
  action: React.ReactNode
  comingSoon?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
            {title}
            {comingSoon ? <ComingSoonBadge /> : null}
          </p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

/**
 * Client-side checks mirror the backend password policy defaults
 * (backend/app/core/security.py: min 8 chars, upper/lowercase, digit,
 * special character); any stricter server-side verdict is surfaced from
 * the response body verbatim.
 */
function validateNewPassword(
  current: string,
  next: string,
  confirm: string,
): string | null {
  if (!current) return 'Enter your current password.'
  if (next.length < 8) return 'New password must be at least 8 characters long.'
  if (next === current)
    return 'New password must be different from the current password.'
  if (next !== confirm) return 'New passwords do not match.'
  return null
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const changePassword = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (changePassword.isPending) return
    if (!next) resetForm()
    onOpenChange(next)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const validationError = validateNewPassword(
      currentPassword,
      newPassword,
      confirmPassword,
    )
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    changePassword.mutate(
      { currentPassword, password: newPassword },
      {
        onSuccess: async () => {
          onOpenChange(false)
          resetForm()
          // The backend revoked all refresh tokens, so finish the forced
          // re-login instead of leaving a session that dies on next refresh.
          toast.success('Password changed. Please sign in again.')
          await logout()
          navigate(ROUTES.login, { replace: true })
        },
        onError: (mutationError) =>
          setError(
            getApiErrorMessage(mutationError, 'Unable to change password.'),
          ),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            At least 8 characters with upper and lowercase letters, a digit,
            and a special character. You'll be signed out everywhere.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              aria-invalid={error ? true : undefined}
            />
          </div>
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={changePassword.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={changePassword.isPending}>
              {changePassword.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
