import { useEffect, useRef } from 'react'
import { Leaf } from 'lucide-react'
import { ChatMessageBubble } from '@/components/analysis/chat/ChatMessageBubble'
import { ImageUploadBubble } from '@/components/analysis/chat/ImageUploadBubble'
import { PredictionResultCard } from '@/components/analysis/chat/PredictionResultCard'
import { TypingIndicator } from '@/components/analysis/chat/TypingIndicator'
import { SuggestedPrompts } from '@/components/analysis/chat/SuggestedPrompts'
import { ChatInput } from '@/components/analysis/chat/ChatInput'
import type { ChatMessage, Prediction } from '@/types/analysis'
import { cn } from '@/lib/utils'

const FALLBACK_PROMPTS = [
  'What are the traditional medicinal uses of this plant?',
  'Is this plant safe to use without preparation?',
  'What active compounds does it contain?',
  'How is this plant typically prepared or dosed?',
]

export type FeedItem =
  | { type: 'image'; id: string; previewUrl: string; isAnalyzing: boolean }
  | { type: 'prediction'; id: string; prediction: Prediction }
  | { type: 'message'; id: string; message: ChatMessage }

interface ChatPanelProps {
  feed: FeedItem[]
  isSending: boolean
  onSendMessage: (message: string) => void
  onAttachImage: (file: File) => void
  attachDisabled?: boolean
  className?: string
}

/**
 * Single, centered, ChatGPT-style conversation column — no separate upload
 * box or side panel. Every feed item (uploaded image, prediction result,
 * text message) renders inline in one scrollable timeline, with the "+"
 * attach button living in ChatInput at the bottom.
 */
export function ChatPanel({
  feed,
  isSending,
  onSendMessage,
  onAttachImage,
  attachDisabled,
  className,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feed.length === 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [feed, isSending])

  return (
    <div className={cn('mx-auto flex w-full max-w-3xl flex-col gap-4', className)}>
      <div className="flex min-h-64 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {feed.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm">
            <Leaf className="text-muted-foreground/50 size-8" />
            <p>
              Attach a leaf photo with the + button to identify a plant and
              start a conversation about it.
            </p>
          </div>
        ) : (
          feed.map((item) => {
            if (item.type === 'image') {
              return (
                <ImageUploadBubble
                  key={item.id}
                  previewUrl={item.previewUrl}
                  isAnalyzing={item.isAnalyzing}
                />
              )
            }
            if (item.type === 'prediction') {
              return (
                <PredictionResultCard key={item.id} prediction={item.prediction} />
              )
            }
            return <ChatMessageBubble key={item.id} message={item.message} />
          })
        )}
        {isSending ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>

      {feed.length > 0 ? (
        <SuggestedPrompts
          prompts={FALLBACK_PROMPTS}
          onSelect={onSendMessage}
          disabled={isSending}
        />
      ) : null}

      <ChatInput
        onSend={onSendMessage}
        onAttachImage={onAttachImage}
        attachDisabled={attachDisabled}
        disabled={isSending}
      />
    </div>
  )
}
