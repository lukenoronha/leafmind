import { useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import { Bot, Check, Copy, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import { SourcesPanel } from '@/components/analysis/chat/SourcesPanel'
import { CITATION_HREF_PREFIX, linkifyCitations } from '@/lib/citations'
import type { ChatMessage } from '@/types/analysis'
import { cn } from '@/lib/utils'

interface ChatMessageBubbleProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const isUser = message.role === 'user'
  const sourceCount = message.sources?.length ?? 0

  const content = useMemo(
    () => linkifyCitations(message.content || ' ', sourceCount),
    [message.content, sourceCount],
  )

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={cn(
        'group flex w-full gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm',
          )}
        >
          <div className="prose prose-sm dark:prose-invert prose-p:my-1.5 prose-pre:my-2 prose-ul:my-1.5 prose-ol:my-1.5 max-w-none">
            <Markdown
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith(CITATION_HREF_PREFIX)) {
                    const index = Number(
                      href.slice(CITATION_HREF_PREFIX.length),
                    )
                    return (
                      <button
                        type="button"
                        className="text-primary bg-primary/10 hover:bg-primary/20 mx-0.5 inline-flex size-4 items-center justify-center rounded-full align-super text-[0.65rem] font-semibold no-underline"
                        onClick={() => setHighlightedIndex(index)}
                        aria-label={`Jump to source ${index}`}
                      >
                        {index}
                      </button>
                    )
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  )
                },
              }}
            >
              {content}
            </Markdown>
          </div>
          {message.isStreaming ? (
            <span
              className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle"
              aria-hidden
            />
          ) : null}
        </div>

        {!isUser && message.sources && message.sources.length > 0 ? (
          <SourcesPanel
            sources={message.sources}
            messageId={message.id}
            highlightedIndex={highlightedIndex}
            className="w-full"
          />
        ) : null}

        <div className="flex items-center gap-2">
          {!isUser && !message.isStreaming && message.responseConfidence ? (
            <ConfidenceBadge
              value={message.responseConfidence}
              label="Response confidence"
            />
          ) : null}

          {!message.isStreaming ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="text-success size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
