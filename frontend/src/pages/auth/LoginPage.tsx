import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
import { useAuth } from '@/hooks/use-auth'
import { classifyApiError, getApiErrorMessage } from '@/lib/api-error'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  const { login, isLoginPending } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginFormValues) {
    try {
      const user = await login(values)
      toast.success(`Welcome back, ${user.name}.`)
      const state = location.state as LocationState | null
      const redirectTo = state?.from?.pathname ?? ROUTES.dashboard
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const kind = classifyApiError(error)
      if (kind === 'network') {
        toast.error('Network error. Check your connection and try again.')
        return
      }
      if (kind === 'timeout' || kind === 'server') {
        toast.error('Server unavailable. Please try again shortly.')
        return
      }
      // 401 (invalid credentials) / 403 (disabled account) — show inline,
      // under the password field, since the backend intentionally doesn't
      // say which of email/password was wrong.
      form.setError('password', {
        message: getApiErrorMessage(error, 'Unable to sign in.'),
      })
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to continue to LeafMind."
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
                    disabled={isLoginPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'login-email-error' : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage id="login-email-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    to={ROUTES.forgotPassword}
                    className="text-primary text-xs font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={isLoginPending}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error ? 'login-password-error' : undefined
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
                <FormMessage id="login-password-error" />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoginPending}>
            {isLoginPending ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </Form>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.signup} className="text-primary font-medium">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
