import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinnedPlantPillProps {
  visible: boolean
  plantName: string
  confidence: number
  imageUrl: string | null
  onClick: () => void
  className?: string
}

/**
 * LeafMind's signature UI element — a compact chip that keeps the
 * identified plant visually present once its full identification card has
 * scrolled out of view, so a long conversation never loses sight of what
 * it's actually about. Docks inset from the feed's top-left on desktop
 * (never a full-width banner competing with the app header); on mobile it
 * docks full-width beneath the page header, per the Visual Design System
 * §11's deliberate divergence for narrow viewports.
 */
export function PinnedPlantPill({
  visible,
  plantName,
  confidence,
  imageUrl,
  onClick,
  className,
}: PinnedPlantPillProps) {
  const prefersReducedMotion = useReducedMotion()
  const percent = Math.round(confidence * 100)

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            'sticky top-0 z-10 flex justify-start sm:justify-center',
            className,
          )}
        >
          <button
            type="button"
            onClick={onClick}
            aria-label={`Scroll to ${plantName} identification, ${percent}% match`}
            className={cn(
              'bg-card/95 hover:bg-card focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-none border-b py-1.5 pr-3 pl-4 shadow-sm backdrop-blur-sm transition-colors outline-none focus-visible:ring-2',
              'sm:w-auto sm:rounded-full sm:border sm:pl-1.5',
            )}
          >
            <span
              className={cn(
                'from-forest-300 to-sage-300 hidden size-7 shrink-0 overflow-hidden rounded-full bg-gradient-to-br sm:block',
              )}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="size-full object-cover"
                />
              ) : null}
            </span>
            <span className="text-foreground truncate text-sm font-semibold">
              {plantName}
            </span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              ·
            </span>
            <span className="text-primary hidden shrink-0 text-xs font-semibold sm:inline">
              {percent}%
            </span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
