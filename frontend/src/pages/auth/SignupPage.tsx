import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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
import { applyApiFieldErrors, classifyApiError, getApiErrorMessage } from '@/lib/api-error'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
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
})

type SignupFormValues = z.infer<typeof signupSchema>

// Backend field names (from the Pydantic error `loc`) → frontend form fields.
const SIGNUP_FIELD_MAP: Record<string, string> = { full_name: 'name' }

export default function SignupPage() {
  const { signup, isSignupPending } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSubmit(values: SignupFormValues) {
    try {
      const user = await signup(values)
      toast.success(`Welcome to LeafMind, ${user.name}.`)
      navigate(ROUTES.dashboard, { replace: true })
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
      const appliedFieldErrors = applyApiFieldErrors(
        error,
        form.setError,
        SIGNUP_FIELD_MAP,
      )
      if (!appliedFieldErrors) {
        // e.g. 409 duplicate email — no per-field `details`, so surface the
        // backend's own message directly on the email field.
        form.setError('email', {
          message: getApiErrorMessage(error, 'Unable to create your account.'),
        })
      }
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start identifying medicinal plants with LeafMind."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Jane Doe"
                    autoComplete="name"
                    autoFocus
                    disabled={isSignupPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'signup-name-error' : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage id="signup-name-error" />
              </FormItem>
            )}
          />
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
                    disabled={isSignupPending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? 'signup-email-error' : undefined
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage id="signup-email-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isSignupPending}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error ? 'signup-password-error' : undefined
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
                <FormMessage id="signup-password-error" />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSignupPending}>
            {isSignupPending ? (
              <>
                <Loader2 className="animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </Form>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Already have an account?{' '}
        <Link to={ROUTES.login} className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
