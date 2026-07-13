import { useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatMessageBubble } from '@/components/analysis/chat/ChatMessageBubble'
import { TypingIndicator } from '@/components/analysis/chat/TypingIndicator'
import { SuggestedPrompts } from '@/components/analysis/chat/SuggestedPrompts'
import { ChatInput } from '@/components/analysis/chat/ChatInput'
import type { ChatMessage } from '@/types/analysis'
import { cn } from '@/lib/utils'

const DEFAULT_PROMPTS = [
  'What are the traditional medicinal uses of this plant?',
  'Is this plant safe to use without preparation?',
  'What active compounds does it contain?',
  'How is this plant typically prepared or dosed?',
]

interface ChatPanelProps {
  plantName: string
  messages: ChatMessage[]
  isSending: boolean
  onSendMessage: (message: string) => void
  className?: string
}

export function ChatPanel({
  plantName,
  messages,
  isSending,
  onSendMessage,
  className,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, isSending])

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="text-primary size-4" />
          Ask about {plantName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex min-h-64 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ask a question about this identification — dosage, traditional
              uses, precautions, or anything else you'd like to know.
            </p>
          ) : (
            messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))
          )}
          {isSending ? <TypingIndicator /> : null}
          <div ref={bottomRef} />
        </div>

        <SuggestedPrompts
          prompts={DEFAULT_PROMPTS}
          onSelect={onSendMessage}
          disabled={isSending}
        />

        <ChatInput onSend={onSendMessage} disabled={isSending} />
      </CardContent>
    </Card>
  )
}
