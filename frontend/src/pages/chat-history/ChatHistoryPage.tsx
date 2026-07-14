import { useMemo, useState } from 'react'
import {
  Download,
  FileJson,
  FileText,
  MessageSquareText,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatConversationDetail } from '@/components/chat-history/ChatConversationDetail'
import { useChatHistory } from '@/hooks/use-chat-history'
import { chatStorage } from '@/lib/chat-storage'
import { exportChatAsJson, exportChatAsMarkdown } from '@/lib/chat-export'
import type { ChatConversationMeta } from '@/lib/chat-storage'

export default function ChatHistoryPage() {
  const { conversations, deleteConversation } = useChatHistory()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ChatConversationMeta | null>(null)
  const [pendingDelete, setPendingDelete] =
    useState<ChatConversationMeta | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) =>
      conversation.plantName.toLowerCase().includes(query),
    )
  }, [conversations, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat History"
        description="Every RAG conversation you've had, saved locally in this browser."
      />

      {conversations.length > 0 ? (
        <Input
          placeholder="Search by plant name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
      ) : null}

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No conversations yet"
          description="Ask a question after your next analysis and it'll show up here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No matching conversations"
          description="Try a different search term."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((conversation) => (
            <Card
              key={conversation.predictionId}
              className="hover:bg-muted/50 transition-colors"
            >
              <CardContent className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSelected(conversation)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-foreground truncate font-medium">
                      {conversation.plantName}
                    </p>
                    <Badge variant="secondary">
                      {conversation.messageCount} messages
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Updated {new Date(conversation.updatedAt).toLocaleString()}
                  </p>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Export conversation about ${conversation.plantName}`}
                    >
                      <Download className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        exportChatAsMarkdown(
                          conversation.plantName,
                          conversation.predictionId,
                          chatStorage.load(conversation.predictionId),
                        )
                      }
                    >
                      <FileText />
                      Export as Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        exportChatAsJson(
                          conversation.plantName,
                          conversation.predictionId,
                          chatStorage.load(conversation.predictionId),
                        )
                      }
                    >
                      <FileJson />
                      Export as JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(conversation)}
                  aria-label={`Delete conversation about ${conversation.plantName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChatConversationDetail
        conversation={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this conversation?"
        description="This permanently removes the conversation from this browser. This action cannot be undone."
        onConfirm={() => {
          if (pendingDelete) deleteConversation(pendingDelete.predictionId)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
