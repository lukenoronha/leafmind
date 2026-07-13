import logoSrc from '@/assets/images/logo.png'
import { cn } from '@/lib/utils'

interface LogoProps {
  showWordmark?: boolean
  className?: string
  imgClassName?: string
  wordmarkClassName?: string
}

export function Logo({
  showWordmark = true,
  className,
  imgClassName,
  wordmarkClassName,
}: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src={logoSrc}
        alt="LeafMind logo"
        className={cn('size-8 object-contain', imgClassName)}
      />
      {showWordmark ? (
        <span
          className={cn(
            'text-foreground text-lg font-semibold tracking-tight',
            wordmarkClassName,
          )}
        >
          LeafMind
        </span>
      ) : null}
    </div>
  )
}
