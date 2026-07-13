import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
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
import { getApiErrorMessage } from '@/lib/api-error'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  const { login, isLoginPending } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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
      toast.error(getApiErrorMessage(error, 'Unable to sign in.'))
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
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
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
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
