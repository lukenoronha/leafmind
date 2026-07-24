import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
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

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const mutation = useMutation({
    mutationFn: authService.forgotPassword,
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
      form.setError('email', {
        message: getApiErrorMessage(error, 'Unable to send the reset link.'),
      })
    },
  })

  function onSubmit(values: ForgotPasswordFormValues) {
    mutation.mutate(values)
  }

  // The backend has no SMTP integration — it never actually sends an email,
  // it only logs the reset link server-side. Reflect that accurately instead
  // of implying an email was sent.
  if (mutation.isSuccess) {
    return (
      <AuthLayout
        title="Password Reset Unavailable"
        description="Password reset email service is currently unavailable. Please contact the administrator to reset your password."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="text-muted-foreground size-10" />
          <Button asChild variant="outline" className="w-full">
            <Link to={ROUTES.login}>Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    disabled={mutation.isPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'forgot-password-email-error' : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage id="forgot-password-email-error" />
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
                Sending link...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </Form>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Remembered your password?{' '}
        <Link to={ROUTES.login} className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
