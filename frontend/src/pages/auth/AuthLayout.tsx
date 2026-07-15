import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Logo } from '@/components/common/Logo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Shared shell for LoginPage/SignupPage — a large brand mark above a
 * premium card, matching the New Analysis page's visual language (warm
 * beige ground, soft shadows, subtle entrance motion) rather than the
 * smaller, unanimated default this replaced.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-8 flex justify-center"
        >
          {/* Logo's showWordmark only toggles the separate HTML span it
           * renders — the "LeafMind" text is also baked into logo.png
           * itself, so this deliberately doesn't add a second wordmark. */}
          <Logo showWordmark={false} imgClassName="size-48 drop-shadow-sm" />
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        >
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
