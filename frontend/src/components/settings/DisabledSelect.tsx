import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * A disabled dropdown for settings whose backend doesn't exist yet. The
 * shown value is always the app's genuine current behavior (never a
 * fabricated choice); the options preview what will become selectable.
 */
export function DisabledSelect({
  value,
  options,
  ariaLabel,
  className,
}: {
  value: string
  options: { value: string; label: string }[]
  ariaLabel: string
  className?: string
}) {
  return (
    <Select value={value} disabled>
      <SelectTrigger
        size="sm"
        className={cn('w-40', className)}
        aria-label={`${ariaLabel} (coming soon)`}
        title="Available after backend integration"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
