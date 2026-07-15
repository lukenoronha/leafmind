import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { UploadHeroCard } from '@/components/analysis/empty-state/UploadHeroCard'

interface EmptyStateProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

/**
 * First-run view of the New Analysis feed. Doubles as the page's entire
 * greeting while the feed is empty — HomePage hides the "New Analysis"
 * PageHeader in this state, so the headline below is the only heading on
 * screen and is sized/centered accordingly. The disclaimer about AI-generated
 * responses lives in ChatPanel, just above the input, so it stays visible
 * once the feed fills up too (matches ChatGPT/Gemini/Claude's placement).
 */
export function EmptyState({ onFileSelected, disabled }: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion()

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 },
    },
  }
  const item = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: 'easeOut' as const },
    },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 text-center"
    >
      <motion.div variants={item} className="space-y-3">
        <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-foreground text-3xl font-semibold text-balance sm:text-4xl">
          Show me a leaf. I&apos;ll tell you what it is — and what it&apos;s
          good for.
        </h1>
      </motion.div>

      <motion.div variants={item} className="w-full max-w-md">
        <UploadHeroCard onFileSelected={onFileSelected} disabled={disabled} />
      </motion.div>
    </motion.div>
  )
}
