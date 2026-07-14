import { useRef, useState, type KeyboardEvent } from 'react'
import { Plus, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ACCEPTED_IMAGE_TYPES_ACCEPT_ATTR,
  validateLeafImageFile,
} from '@/lib/image-validation'

interface ChatInputProps {
  onSend: (message: string) => void
  onAttachImage?: (file: File) => void
  attachDisabled?: boolean
  disabled?: boolean
}

export function ChatInput({
  onSend,
  onAttachImage,
  attachDisabled,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
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
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      {attachError ? (
        <p role="alert" className="text-destructive px-1 text-xs">
          {attachError}
        </p>
      ) : null}
    </div>
  )
}
