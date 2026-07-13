import { useState } from 'react'
import Markdown from 'react-markdown'
import { FileSearch, Leaf, MessageSquareText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfidenceBadge } from '@/components/analysis/ConfidenceBadge'
import { usePromptInspectorEntries } from '@/hooks/use-developer-dashboard'
import { cn } from '@/lib/utils'

export function PromptInspector() {
  const { data, isLoading, isError, refetch } = usePromptInspectorEntries()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = data?.find((entry) => entry.id === selectedId) ?? data?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt inspector</CardTitle>
        <CardDescription>
          Inspect the question, prediction, retrieved context, and generated
          response behind any chat exchange.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load prompts"
            description="We couldn't reach the prompt inspector endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No exchanges yet"
            description="Prompt/response pairs will appear here once users start chatting."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
              {data.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                      (selected?.id ?? data[0]?.id) === entry.id
                        ? 'border-primary bg-accent'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <p className="text-foreground line-clamp-2 font-medium">
                      {entry.question}
                    </p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <Leaf className="size-3" />
                      {entry.predictedPlant}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                    <MessageSquareText className="size-3.5" />
                    Question
                  </p>
                  <p className="text-foreground text-sm">{selected.question}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                    <Leaf className="size-3.5" />
                    Predicted plant
                  </p>
                  <p className="text-foreground text-sm font-medium">
                    {selected.predictedPlant}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Retrieved context ({selected.retrievedContext.length})
                  </p>
                  <div className="space-y-1.5">
                    {selected.retrievedContext.map((source) => (
                      <div
                        key={source.id}
                        className="bg-muted/50 flex items-start justify-between gap-3 rounded-md p-2 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-foreground truncate font-medium">
                            {source.documentTitle}
                          </p>
                          <p className="text-muted-foreground">
                            {source.chapter} &middot; Page {source.pageNumber}
                          </p>
                        </div>
                        <ConfidenceBadge
                          value={source.retrievalConfidence}
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Generated response
                    </p>
                    <ConfidenceBadge
                      value={selected.responseConfidence}
                      label="Confidence"
                    />
                  </div>
                  <div className="prose prose-sm dark:prose-invert bg-muted/50 max-w-none rounded-md p-3">
                    <Markdown>{selected.generatedResponse}</Markdown>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
