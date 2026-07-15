import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, ImageIcon, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UploadErrorCard } from '@/components/analysis/empty-state/UploadErrorCard'
import type { ImageFeedStatus } from '@/components/analysis/chat/ChatPanel'
import {
  ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR,
  validateLeafImageFile,
} from '@/lib/image-validation'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ImageUploadBubbleProps {
  previewUrl: string
  filename: string
  sizeBytes: number
  status: ImageFeedStatus
  /** 0-100, only meaningful while status is 'uploading'. */
  progress?: number
  errorMessage?: string
  onReplace: (file: File) => void
  onRemove: () => void
  className?: string
}

/** User's uploaded leaf photo, rendered as a feed item (right-aligned, like
 * a user chat bubble). Shows filename/size, an animated processing
 * timeline while upload+predict are in flight, and replace/remove
 * controls once the photo is settled. */
export function ImageUploadBubble({
  previewUrl,
  filename,
  sizeBytes,
  status,
  progress,
  errorMessage,
  onReplace,
  onRemove,
  className,
}: ImageUploadBubbleProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [localError, setLocalError] = useState<string | null>(null)

  function handleReplaceFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const error = validateLeafImageFile(file)
    setLocalError(error)
    if (error) return

    onReplace(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('flex w-full flex-row-reverse gap-3', className)}>
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex max-w-[70%] flex-col items-end gap-1.5"
      >
        <div className="group/bubble bg-muted relative overflow-hidden rounded-2xl rounded-tr-sm border">
          <img
            src={previewUrl}
            alt={`Uploaded leaf photo: ${filename}`}
            className="max-h-64 w-full object-contain"
          />

          {status === 'uploading' ? (
            <div
              role="status"
              aria-live="polite"
              className="bg-background/85 absolute inset-0 flex flex-col items-center justify-center px-4 backdrop-blur-sm"
            >
              <span className="text-muted-foreground text-xs font-medium">
                Uploading
                {typeof progress === 'number' ? ` · ${Math.round(progress)}%` : ''}
              </span>
            </div>
          ) : status === 'analyzing' ? null : (
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/bubble:opacity-100 sm:focus-within:opacity-100">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-9 rounded-full shadow"
                onClick={() => inputRef.current?.click()}
                aria-label="Replace photo"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-9 rounded-full shadow"
                onClick={onRemove}
                aria-label="Remove photo"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {status === 'done' ? (
            <motion.div
              role="img"
              aria-label="Identification complete"
              initial={
                prefersReducedMotion ? undefined : { scale: 0, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: 'backOut', delay: 0.1 }}
              className="text-primary bg-background absolute bottom-2 left-2 rounded-full shadow"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </motion.div>
          ) : null}
        </div>

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="max-w-40 truncate">{filename}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(sizeBytes)}</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR}
          aria-label="Replace photo"
          className="hidden"
          onChange={(event) => handleReplaceFile(event.target.files)}
        />

        {status === 'error' && errorMessage ? (
          <UploadErrorCard message={errorMessage} className="w-full" />
        ) : null}
        {localError ? (
          <UploadErrorCard message={localError} className="w-full" />
        ) : null}
      </motion.div>
    </div>
  )
}
