import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoaderProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  className?: string
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
}

export function Loader({
  label,
  size = 'md',
  fullScreen = false,
  className,
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-3',
        fullScreen && 'min-h-[60vh] w-full',
        className,
      )}
    >
      <Loader2 className={cn('text-primary animate-spin', sizeMap[size])} />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  )
}
