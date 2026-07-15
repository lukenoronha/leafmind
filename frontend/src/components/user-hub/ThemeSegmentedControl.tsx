import { useRef } from 'react'
import { useTheme } from 'next-themes'
import { Laptop, Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
] as const

export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme()
  const active = theme ?? 'system'
  const prefersReducedMotion = useReducedMotion()
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // role="radiogroup"/"radio" implies the standard ARIA radio pattern —
  // arrow keys move selection between options, and only the checked option
  // sits in the Tab order (roving tabindex), with DOM focus following the
  // selection. Without this, every option was independently tabbable with
  // no arrow-key handling, which doesn't match what the declared roles
  // promise a screen reader/keyboard user.
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = OPTIONS.findIndex((option) => option.value === active)
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % OPTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + OPTIONS.length) % OPTIONS.length
    }

    if (nextIndex === null) return
    event.preventDefault()
    setTheme(OPTIONS[nextIndex].value)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
    >
      {OPTIONS.map((option, index) => {
        const isActive = active === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setTheme(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'focus-visible:ring-ring/50 relative flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : 'theme-segment-active'}
                className="bg-background absolute inset-0 rounded-md shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            ) : null}
            <Icon className="relative size-3.5" aria-hidden="true" />
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
