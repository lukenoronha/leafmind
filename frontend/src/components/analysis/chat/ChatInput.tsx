import { useRef, useState, type KeyboardEvent } from 'react'
import { ImageIcon, Plus, SendHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UploadErrorCard } from '@/components/analysis/empty-state/UploadErrorCard'
import {
  ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR,
  validateLeafImageFile,
} from '@/lib/image-validation'
import { formatBytes } from '@/lib/utils'

export interface PendingAttachment {
  file: File
  previewUrl: string
}

interface ChatInputProps {
  onSend: (message: string) => void
  onAttachImage?: (file: File) => void
  attachDisabled?: boolean
  disabled?: boolean
  /** Image staged via the "+" button or empty-state dropzone, shown as a
   * preview above the input until Send is pressed — it isn't uploaded or
   * added to the conversation until then. */
  pendingAttachment?: PendingAttachment | null
  onRemovePendingAttachment?: () => void
}

export function ChatInput({
  onSend,
  onAttachImage,
  attachDisabled,
  disabled,
  pendingAttachment,
  onRemovePendingAttachment,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = value.trim()
    if (disabled) return
    if (!trimmed && !pendingAttachment) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  function handleFileChange(files: FileList | null) {
    const file = files?.[0]
    if (!file || !onAttachImage) return

    const error = validateLeafImageFile(file)
    setAttachError(error)
    if (error) return

    onAttachImage(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      {pendingAttachment ? (
        <div className="bg-muted/40 flex items-center gap-3 rounded-xl border px-3 py-2">
          <img
            src={pendingAttachment.previewUrl}
            alt={`Selected leaf photo: ${pendingAttachment.file.name}`}
            className="size-10 shrink-0 rounded-lg object-cover"
          />
          <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-xs">
            <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{pendingAttachment.file.name}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {formatBytes(pendingAttachment.file.size)}
            </span>
          </div>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="shrink-0 rounded-full"
            onClick={onRemovePendingAttachment}
            aria-label="Remove selected photo"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        {onAttachImage ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachDisabled}
              aria-label="Attach a leaf photo"
            >
              <Plus className="size-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR}
              aria-label="Attach a leaf photo"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files)}
            />
          </>
        ) : null}

        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this plant's uses, dosage, or precautions..."
          rows={1}
          className="max-h-40 min-h-11 resize-none"
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          className="shrink-0"
          onClick={submit}
          disabled={
            disabled || (value.trim().length === 0 && !pendingAttachment)
          }
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      {attachError ? <UploadErrorCard message={attachError} /> : null}
    </div>
  )
}
