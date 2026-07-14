import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { UploadHeroCard } from '@/components/analysis/empty-state/UploadHeroCard'
import { SampleImageCard } from '@/components/analysis/empty-state/SampleImageCard'

const SAMPLE_PLANTS = [
  {
    name: 'Neem',
    scientificName: 'Azadirachta indica',
    gradientClassName: 'bg-gradient-to-br from-forest-300 to-sage-300',
  },
  {
    name: 'Tulsi',
    scientificName: 'Ocimum tenuiflorum',
    gradientClassName: 'bg-gradient-to-br from-forest-400 to-sage-200',
  },
  {
    name: 'Aloe Vera',
    scientificName: 'Aloe barbadensis',
    gradientClassName: 'bg-gradient-to-br from-sage-400 to-forest-200',
  },
] as const

interface EmptyStateProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

/**
 * First-run view of the New Analysis feed. The upload card is wired to the
 * real upload pipeline (Task 3); sample chips remain presentational since
 * no bundled sample-photo assets exist yet in this codebase.
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
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 py-8 text-center"
    >
      <motion.div variants={item} className="space-y-3">
        <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-foreground text-2xl font-semibold text-balance sm:text-3xl">
          Show me a leaf. I&apos;ll tell you what it is — and what it&apos;s
          good for.
        </h2>
        <p className="text-muted-foreground text-sm text-balance sm:text-base">
          Upload a photo and I&apos;ll identify the species, then you can ask me
          anything about its medicinal uses, safety, or traditional preparation
          — grounded in cited reference sources.
        </p>
      </motion.div>

      <motion.div variants={item} className="w-full">
        <UploadHeroCard onFileSelected={onFileSelected} disabled={disabled} />
      </motion.div>

      <motion.div variants={item} className="w-full space-y-3">
        <p className="text-muted-foreground text-xs">
          No leaf handy? Try a sample —
        </p>
        <div className="flex items-center justify-center gap-4">
          {SAMPLE_PLANTS.map((plant) => (
            <SampleImageCard key={plant.name} {...plant} />
          ))}
        </div>
      </motion.div>

      <motion.p
        variants={item}
        className="text-muted-foreground max-w-sm text-xs leading-relaxed text-balance"
      >
        AI-generated responses are grounded using trusted reference sources.
        Always verify medicinal usage with qualified professionals.
      </motion.p>
    </motion.div>
  )
}
