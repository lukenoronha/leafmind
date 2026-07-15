import { cn } from '@/lib/utils'

/**
 * Marks a control that has no backend endpoint yet. Every disabled
 * profile-page control pairs one of these with a
 * "Available after backend integration" title so the state is
 * self-explanatory on hover and to screen readers.
 */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      title="Available after backend integration"
      className={cn(
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[0.65rem] font-medium',
        className,
      )}
    >
      Coming soon
    </span>
  )
}
