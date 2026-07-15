import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  accept: string
  hint: string
  isUploading?: boolean
  progress?: number
  onFileSelected: (file: File) => void
  onFilesSelected?: (files: File[]) => void
  multiple?: boolean
  className?: string
}

export function FileDropzone({
  accept,
  hint,
  isUploading = false,
  progress = 0,
  onFileSelected,
  onFilesSelected,
  multiple = false,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      if (multiple && onFilesSelected) {
        onFilesSelected(Array.from(files))
        return
      }
      onFileSelected(files[0])
    },
    [onFileSelected, onFilesSelected, multiple],
  )

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !isUploading && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!isUploading && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault()
        if (!isUploading) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50',
        isUploading && 'pointer-events-none',
        className,
      )}
    >
      {isUploading ? (
        <>
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-foreground text-sm font-medium">
            Uploading... {progress}%
          </p>
          <Progress value={progress} className="w-40" />
        </>
      ) : (
        <>
          <UploadCloud className="text-muted-foreground size-6" />
          <p className="text-foreground text-sm font-medium">
            Drag and drop, or click to browse
          </p>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  )
}
