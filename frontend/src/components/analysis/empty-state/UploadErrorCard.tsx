import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadErrorCardProps {
  message: string
  className?: string
}

/** Inline validation error — replaces browser alerts and toast-only
 * feedback for attach/replace failures the user can act on immediately. */
export function UploadErrorCard({ message, className }: UploadErrorCardProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      role="alert"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </motion.div>
  )
}
