import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/routes/paths'
import { AuthLayout } from '@/pages/auth/AuthLayout'
import { authService } from '@/services/auth.service'
import { classifyApiError, getApiErrorMessage } from '@/lib/api-error'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit')
      .regex(
        /[^\w\s]/,
        'Password must contain at least one special character',
      ),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (password: string) =>
      authService.resetPassword({ token: token ?? '', password }),
    onError: (error) => {
      const kind = classifyApiError(error)
      if (kind === 'network') {
        toast.error('Network error. Check your connection and try again.')
        return
      }
      if (kind === 'timeout' || kind === 'server') {
        toast.error('Server unavailable. Please try again shortly.')
        return
      }
      // Invalid/expired/used token — backend message is specific and useful.
      form.setError('password', {
        message: getApiErrorMessage(error, 'Unable to reset your password.'),
      })
    },
  })

  function onSubmit(values: ResetPasswordFormValues) {
    mutation.mutate(values.password)
  }

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        description="This password reset link is missing or malformed."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="text-destructive size-10" />
          <Button asChild variant="outline" className="w-full">
            <Link to={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (mutation.isSuccess) {
    return (
      <AuthLayout
        title="Password updated"
        description="Your password has been reset. You can now sign in."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="text-success size-10" />
          <Button asChild className="w-full">
            <Link to={ROUTES.login}>Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a new password for your account."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      autoFocus
                      disabled={mutation.isPending}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error ? 'reset-password-error' : undefined
                      }
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage id="reset-password-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={mutation.isPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'reset-confirm-password-error' : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage id="reset-confirm-password-error" />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
