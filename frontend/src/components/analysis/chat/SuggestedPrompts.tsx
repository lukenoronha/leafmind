import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  FlaskConical,
  Leaf,
  Pill,
  Scale,
  Sparkles,
  Sprout,
  TriangleAlert,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SuggestedTopic } from '@/lib/suggested-prompts'

const TOPIC_ICON: Record<string, typeof Pill> = {
  'medicinal-uses': Pill,
  dosage: Scale,
  'side-effects': TriangleAlert,
  toxicity: TriangleAlert,
  compounds: FlaskConical,
  taxonomy: Workflow,
  'ayurvedic-uses': Sprout,
  'environmental-importance': Leaf,
  compare: Sparkles,
}

interface SuggestedPromptsProps {
  topics: SuggestedTopic[]
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function SuggestedPrompts({
  topics,
  onSelect,
  disabled,
}: SuggestedPromptsProps) {
  const prefersReducedMotion = useReducedMotion()

  if (topics.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Suggested questions"
      className="flex flex-wrap gap-2"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {topics.map((topic, index) => {
          const Icon = TOPIC_ICON[topic.id] ?? Sparkles

          return (
            <motion.div
              key={topic.id}
              layout={!prefersReducedMotion}
              initial={
                prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }
              }
              transition={{
                duration: 0.18,
                delay: index * 0.03,
                ease: 'easeOut',
              }}
              whileHover={prefersReducedMotion ? undefined : { y: -1 }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto gap-1.5 rounded-full text-left whitespace-normal"
                disabled={disabled}
                onClick={() => onSelect(topic.prompt)}
              >
                <Icon className="text-primary size-3.5" aria-hidden="true" />
                {topic.label}
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
