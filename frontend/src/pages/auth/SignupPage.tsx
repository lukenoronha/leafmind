import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const { signup, isSignupPending } = useAuth()
  const navigate = useNavigate()

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
      toast.error(getApiErrorMessage(error, 'Unable to create your account.'))
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Jane Doe"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
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
