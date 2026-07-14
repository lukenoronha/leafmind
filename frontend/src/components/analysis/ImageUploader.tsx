import { useCallback, useRef, useState, type DragEvent } from 'react'
import { ImageUp, Loader2, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR,
  validateLeafImageFile,
} from '@/lib/image-validation'
import { cn } from '@/lib/utils'

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'error'

interface ImageUploaderProps {
  status: UploadStatus
  progress?: number
  errorMessage?: string
  previewUrl?: string | null
  onFileSelected: (file: File) => void
  onClear: () => void
  className?: string
}

export function ImageUploader({
  status,
  progress = 0,
  errorMessage,
  previewUrl,
  onFileSelected,
  onClear,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const isBusy = status === 'uploading' || status === 'processing'

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return

      const error = validateLeafImageFile(file)
      setValidationError(error)
      if (error) return

      onFileSelected(file)
    },
    [onFileSelected],
  )

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (isBusy) return
    handleFiles(event.dataTransfer.files)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!isBusy) setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  const combinedError = validationError ?? errorMessage

  if (previewUrl) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="bg-muted relative overflow-hidden rounded-xl border">
          <img
            src={previewUrl}
            alt="Uploaded plant leaf"
            className="max-h-96 w-full object-contain"
          />
          {isBusy ? (
            <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
              <Loader2 className="text-primary size-6 animate-spin" />
              <p className="text-foreground text-sm font-medium">
                {status === 'uploading'
                  ? `Uploading... ${progress}%`
                  : 'Analyzing image...'}
              </p>
              {status === 'uploading' ? (
                <Progress value={progress} className="w-40" />
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 size-8 rounded-full shadow"
              onClick={onClear}
              aria-label="Remove image"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        {!isBusy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <RotateCcw />
            Replace image
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          combinedError && 'border-destructive/50 bg-destructive/5',
        )}
      >
        <ImageUp className="text-muted-foreground size-8" />
        <div className="space-y-1">
          <p className="text-foreground font-medium">
            Drag and drop a leaf photo, or click to browse
          </p>
          <p className="text-muted-foreground text-sm">
            JPEG, PNG, or WEBP — up to 10 MB
          </p>
        </div>
      </div>
      {combinedError ? (
        <p role="alert" className="text-destructive text-sm">
          {combinedError}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  )
}
