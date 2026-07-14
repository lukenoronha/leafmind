import { useState } from 'react'
import Markdown from 'react-markdown'
import { FileSearch, Leaf, MessageSquareText, Search } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import { usePromptInspectorEntry } from '@/hooks/use-developer-dashboard'

/**
 * The backend can only inspect one chat turn at a time, by its assistant
 * ChatMessage ID (GET /developer/chat-messages/{id}/prompt-inspector) —
 * there is no bulk listing endpoint, so this looks up a single ID rather
 * than browsing a list. Find a chat message ID via the chat history page.
 */
export function PromptInspector() {
  const [inputValue, setInputValue] = useState('')
  const [chatMessageId, setChatMessageId] = useState<string | null>(null)
  const { data: selected, isLoading, isError, refetch } =
    usePromptInspectorEntry(chatMessageId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt inspector</CardTitle>
        <CardDescription>
          Inspect the question, prediction, retrieved context, and generated
          response behind a chat exchange, by its chat message ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setChatMessageId(inputValue.trim() || null)
          }}
        >
          <Input
            placeholder="Chat message ID..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            <Search />
            Inspect
          </Button>
        </form>

        {!chatMessageId ? (
          <EmptyState
            icon={FileSearch}
            title="No message selected"
            description="Paste a chat message ID above to inspect the prompt behind it."
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : isError || !selected ? (
          <ErrorState
            title="Unable to load this message"
            description="Check the ID and try again."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <MessageSquareText className="size-3.5" />
                Question
              </p>
              <p className="text-foreground text-sm">{selected.question}</p>
            </div>

            {selected.predictedPlant ? (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                  <Leaf className="size-3.5" />
                  Predicted plant
                </p>
                <p className="text-foreground text-sm font-medium">
                  {selected.predictedPlant}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Retrieved context ({selected.retrievedContext.length})
              </p>
              <div className="space-y-1.5">
                {selected.retrievedContext.map((source) => (
                  <div
                    key={source.chunkId}
                    className="bg-muted/50 flex items-start justify-between gap-3 rounded-md p-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-foreground truncate font-medium">
                        {source.documentName}
                      </p>
                      <p className="text-muted-foreground">
                        {source.chapter}
                        {source.chapter && source.pageNumber !== null ? ' · ' : ''}
                        {source.pageNumber !== null ? `Page ${source.pageNumber}` : ''}
                      </p>
                    </div>
                    <ConfidenceBadge value={source.score} className="shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Generated response
              </p>
              <div className="prose prose-sm dark:prose-invert bg-muted/50 max-w-none rounded-md p-3">
                <Markdown>{selected.generatedResponse}</Markdown>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
