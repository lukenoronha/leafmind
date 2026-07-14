import { cn } from '@/lib/utils'

interface PredictionMediaBandProps {
  imageUrl: string | null
  plantName: string
  className?: string
}

/** Compact photo header for the identification card — anchors the result
 * to the specific photo the user uploaded rather than reading as a bare
 * database lookup. Falls back to a plain gradient if no preview URL is
 * available (e.g. a rehydrated session with no local blob left). */
export function PredictionMediaBand({
  imageUrl,
  plantName,
  className,
}: PredictionMediaBandProps) {
  return (
    <div
      className={cn(
        'from-forest-200 to-sage-200 relative h-28 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br',
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={
            plantName
              ? `Photo used to identify ${plantName}`
              : 'Photo used to identify this plant'
          }
          className="size-full object-cover"
        />
      ) : null}
    </div>
  )
}
