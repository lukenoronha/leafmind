import { motion, useReducedMotion } from 'framer-motion'
import { Bot } from 'lucide-react'

const DOT_TRANSITION = {
  duration: 0.9,
  repeat: Infinity,
  ease: 'easeInOut' as const,
}

export function TypingIndicator() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex w-full gap-3"
      role="status"
      aria-label="Assistant is typing"
    >
      <div className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
        <Bot className="size-4" />
      </div>
      <div className="bg-muted flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="bg-muted-foreground size-1.5 rounded-full"
            animate={
              prefersReducedMotion
                ? { opacity: [0.4, 1, 0.4] }
                : { y: [0, -4, 0] }
            }
            transition={{ ...DOT_TRANSITION, delay: index * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  )
}
