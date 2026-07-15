import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/analysis/empty-state/EmptyState'
import { ChatMessageBubble } from '@/components/analysis/chat/ChatMessageBubble'
import { ImageUploadBubble } from '@/components/analysis/chat/ImageUploadBubble'
import { PredictionResultCard } from '@/components/analysis/chat/PredictionResultCard'
import { PinnedPlantPill } from '@/components/analysis/chat/PinnedPlantPill'
import { TypingIndicator } from '@/components/analysis/chat/TypingIndicator'
import { SuggestedPrompts } from '@/components/analysis/chat/SuggestedPrompts'
import { ChatInput } from '@/components/analysis/chat/ChatInput'
import { selectSuggestedTopics } from '@/lib/suggested-prompts'
import type { InspectorTab } from '@/components/analysis/inspector/AnalysisInspector'
import type { ChatMessage, Prediction } from '@/types/analysis'
import { cn } from '@/lib/utils'

export type ImageFeedStatus = 'uploading' | 'analyzing' | 'done' | 'error'

export type FeedItem =
  | {
      type: 'image'
      id: string
      previewUrl: string
      filename: string
      sizeBytes: number
      status: ImageFeedStatus
      /** 0-100, only meaningful while status is 'uploading'. */
      progress?: number
      errorMessage?: string
      /** Backend-assigned image ID, set once the upload resolves — links
       * this feed item to a later Prediction.imageId so the identification
       * card can show the same photo in its media band. */
      backendImageId?: string
    }
  | { type: 'prediction'; id: string; prediction: Prediction }
  | { type: 'message'; id: string; message: ChatMessage }

interface ChatPanelProps {
  feed: FeedItem[]
  isSending: boolean
  onSendMessage: (message: string) => void
  onAttachImage: (file: File) => void
  onReplaceImage: (id: string, file: File) => void
  onRemoveImage: (id: string) => void
  onOpenInspector: (predictionId: string, tab: InspectorTab) => void
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
  onReplaceImage,
  onRemoveImage,
  onOpenInspector,
  attachDisabled,
  className,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const feedContainerRef = useRef<HTMLDivElement>(null)
  const latestCardRef = useRef<HTMLDivElement>(null)
  const [isLatestCardOffscreen, setIsLatestCardOffscreen] = useState(false)

  useEffect(() => {
    if (feed.length === 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [feed, isSending])

  const latestPredictionItem = useMemo(
    () => feed.filter((item) => item.type === 'prediction').at(-1),
    [feed],
  )
  const latestPrediction = latestPredictionItem?.prediction

  // Pinned pill (Task 9) appears once the latest identification card has
  // scrolled out of the feed's visible area — observed against the feed's
  // own scroll container, not the window, since the card scrolls within
  // it rather than the page.
  useEffect(() => {
    const card = latestCardRef.current
    const root = feedContainerRef.current
    if (!card || !root || !latestPredictionItem) {
      setIsLatestCardOffscreen(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsLatestCardOffscreen(!entry.isIntersecting),
      { root, threshold: 0 },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [latestPredictionItem])

  function scrollToLatestCard() {
    latestCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const suggestedTopics = useMemo(() => {
    if (!latestPrediction) return []
    const userMessages = feed
      .filter((item) => item.type === 'message' && item.message.role === 'user')
      .map((item) => (item.type === 'message' ? item.message.content : ''))

    return selectSuggestedTopics({
      userMessages,
      hasRunnerUpCandidate: latestPrediction.candidates.length > 1,
    })
  }, [feed, latestPrediction])

  // Built once per feed change rather than re-scanning the whole feed for
  // every prediction card on every render.
  const imageUrlByBackendId = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of feed) {
      if (item.type === 'image' && item.backendImageId) {
        map.set(item.backendImageId, item.previewUrl)
      }
    }
    return map
  }, [feed])

  function findSourceImageUrl(prediction: Prediction) {
    return imageUrlByBackendId.get(prediction.imageId) ?? null
  }

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-160 flex-col gap-6 xl:max-w-170 2xl:max-w-200',
        className,
      )}
    >
      <div
        ref={feedContainerRef}
        role="log"
        aria-label="Analysis conversation"
        aria-live="polite"
        tabIndex={0}
        className="focus-visible:ring-ring/50 relative flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto rounded-lg pr-1 outline-none focus-visible:ring-2"
      >
        {latestPrediction ? (
          <PinnedPlantPill
            visible={isLatestCardOffscreen}
            plantName={latestPrediction.plantName}
            confidence={latestPrediction.confidence}
            imageUrl={findSourceImageUrl(latestPrediction)}
            onClick={scrollToLatestCard}
          />
        ) : null}

        {feed.length === 0 ? (
          <EmptyState
            onFileSelected={onAttachImage}
            disabled={attachDisabled}
          />
        ) : (
          feed.map((item) => {
            if (item.type === 'image') {
              return (
                <ImageUploadBubble
                  key={item.id}
                  previewUrl={item.previewUrl}
                  filename={item.filename}
                  sizeBytes={item.sizeBytes}
                  status={item.status}
                  progress={item.progress}
                  errorMessage={item.errorMessage}
                  onReplace={(file) => onReplaceImage(item.id, file)}
                  onRemove={() => onRemoveImage(item.id)}
                />
              )
            }
            if (item.type === 'prediction') {
              const isLatestCard = item.id === latestPredictionItem?.id

              return (
                <PredictionResultCard
                  key={item.id}
                  ref={isLatestCard ? latestCardRef : undefined}
                  prediction={item.prediction}
                  imageUrl={findSourceImageUrl(item.prediction)}
                  onOpenInspector={(tab) =>
                    onOpenInspector(item.prediction.id, tab)
                  }
                />
              )
            }
            return <ChatMessageBubble key={item.id} message={item.message} />
          })
        )}
        {isSending ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>

      {suggestedTopics.length > 0 ? (
        <SuggestedPrompts
          topics={suggestedTopics}
          onSelect={onSendMessage}
          disabled={isSending}
        />
      ) : null}

      <div className="space-y-2">
        <p className="text-muted-foreground text-center text-xs text-balance">
          AI-generated responses are grounded using trusted reference sources.
          Always verify medicinal usage with qualified professionals.
        </p>
        <ChatInput
          onSend={onSendMessage}
          onAttachImage={onAttachImage}
          attachDisabled={attachDisabled}
          disabled={isSending}
        />
      </div>
    </div>
  )
}
