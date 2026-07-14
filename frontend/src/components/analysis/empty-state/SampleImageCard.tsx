import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SampleImageCardProps {
  name: string
  scientificName: string
  /** Tailwind gradient classes — used until real reference photos exist. */
  gradientClassName: string
  onSelect?: () => void
  disabled?: boolean
  className?: string
}

/**
 * A single "try a sample" chip in the empty state. Presentational only —
 * `onSelect` is left undefined for now (Task 2 is UI-only); Task 3 wires it
 * to the real upload pipeline using a bundled sample asset.
 */
export function SampleImageCard({
  name,
  scientificName,
  gradientClassName,
  onSelect,
  disabled,
  className,
}: SampleImageCardProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={`Try a sample photo of ${name}`}
      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'group focus-visible:ring-ring/50 flex flex-col items-center gap-2 rounded-lg p-1 text-center outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <div
        className={cn(
          'ring-border group-hover:ring-primary/40 size-16 rounded-2xl shadow-sm ring-1 transition-all',
          gradientClassName,
        )}
      />
      <div className="space-y-0.5">
        <p className="text-foreground text-xs font-medium">{name}</p>
        <p className="text-muted-foreground text-[11px] italic">
          {scientificName}
        </p>
      </div>
    </motion.button>
  )
}
