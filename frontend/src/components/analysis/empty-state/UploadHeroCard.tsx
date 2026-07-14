import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UploadErrorCard } from '@/components/analysis/empty-state/UploadErrorCard'
import {
  ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR,
  validateLeafImageFile,
} from '@/lib/image-validation'
import { cn } from '@/lib/utils'

interface UploadHeroCardProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
  className?: string
}

/**
 * Large, fully-clickable upload target for the empty state. Handles
 * selection (click, keyboard, drag-and-drop) and client-side validation
 * itself; the caller owns everything that happens after a valid file is
 * chosen (upload + predict, unchanged from the existing pipeline).
 */
export function UploadHeroCard({
  onFileSelected,
  disabled,
  className,
}: UploadHeroCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()

  function openBrowser() {
    if (disabled) return
    inputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const error = validateLeafImageFile(file)
    setValidationError(error)
    if (error) return

    onFileSelected(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (disabled) return
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    handleFiles(event.dataTransfer.files)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openBrowser()
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a leaf photo — click to browse or drag and drop"
        aria-disabled={disabled}
        onClick={openBrowser}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
        whileHover={
          disabled || prefersReducedMotion ? undefined : { scale: 1.005 }
        }
        className={cn(
          'bg-muted/40 focus-visible:ring-ring/50 border-1.5 flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-2 sm:px-10 sm:py-12',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50',
          validationError && 'border-destructive/50 bg-destructive/5',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: isDragging ? 1.15 : 1, y: isDragging ? -2 : 0 }
          }
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full"
        >
          <Upload className="size-5" aria-hidden="true" />
        </motion.div>

        <div className="space-y-1">
          <p className="text-foreground text-base font-semibold">
            {isDragging
              ? 'Drop your leaf image here'
              : 'Drop a leaf photo here'}
          </p>
          <p className="text-muted-foreground text-sm">
            JPEG, PNG, or WEBP · up to 10 MB
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              openBrowser()
            }}
          >
            <Upload />
            Browse files
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            title="Camera capture is coming soon"
            onClick={(event) => event.stopPropagation()}
          >
            <Camera />
            Use camera
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR}
          aria-label="Upload a leaf photo"
          className="hidden"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </motion.div>

      {validationError ? <UploadErrorCard message={validationError} /> : null}
    </div>
  )
}
