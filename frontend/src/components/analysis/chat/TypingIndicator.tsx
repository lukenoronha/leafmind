import { Bot } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div
      className="flex w-full gap-3"
      role="status"
      aria-label="Assistant is typing"
    >
      <div className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
        <Bot className="size-4" />
      </div>
      <div className="bg-muted flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
        <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full" />
      </div>
    </div>
  )
}
