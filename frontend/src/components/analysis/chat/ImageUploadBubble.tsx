import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadBubbleProps {
  previewUrl: string
  isAnalyzing: boolean
  className?: string
}

/** User's uploaded leaf photo, rendered as a feed item (right-aligned, like
 * a user chat bubble), with an inline "Analyzing..." indicator while
 * upload+predict are in flight. */
export function ImageUploadBubble({
  previewUrl,
  isAnalyzing,
  className,
}: ImageUploadBubbleProps) {
  return (
    <div className={cn('flex w-full flex-row-reverse gap-3', className)}>
      <div className="flex max-w-[70%] flex-col items-end gap-1.5">
        <div className="bg-muted relative overflow-hidden rounded-2xl rounded-tr-sm border">
          <img
            src={previewUrl}
            alt="Uploaded leaf"
            className="max-h-64 w-full object-contain"
          />
        </div>
        {isAnalyzing ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Analyzing image...
          </p>
        ) : null}
      </div>
    </div>
  )
}
