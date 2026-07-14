import { useMemo } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatMessageBubble } from '@/components/analysis/chat/ChatMessageBubble'
import { chatStorage } from '@/lib/chat-storage'
import { exportChatAsJson, exportChatAsMarkdown } from '@/lib/chat-export'
import type { ChatConversationMeta } from '@/lib/chat-storage'

interface ChatConversationDetailProps {
  conversation: ChatConversationMeta | null
  onOpenChange: (open: boolean) => void
}

export function ChatConversationDetail({
  conversation,
  onOpenChange,
}: ChatConversationDetailProps) {
  const currentMessages = useMemo(
    () => (conversation ? chatStorage.load(conversation.predictionId) : []),
    [conversation],
  )

  return (
    <Dialog open={!!conversation} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>
                Conversation about {conversation?.plantName}
              </DialogTitle>
              <DialogDescription>
                {conversation
                  ? `${conversation.messageCount} messages · last updated ${new Date(conversation.updatedAt).toLocaleString()}`
                  : null}
              </DialogDescription>
            </div>
            {conversation ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Download />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      exportChatAsMarkdown(
                        conversation.plantName,
                        conversation.predictionId,
                        currentMessages,
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
                        currentMessages,
                      )
                    }
                  >
                    <FileJson />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {currentMessages.map((message) => (
            <ChatMessageBubble key={message.id} message={message} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
