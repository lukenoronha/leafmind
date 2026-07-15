import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ChatPanel, type FeedItem } from '@/components/analysis/chat/ChatPanel'
import type { PendingAttachment } from '@/components/analysis/chat/ChatInput'
import {
  AnalysisInspector,
  type InspectorTab,
} from '@/components/analysis/inspector/AnalysisInspector'
import { ReportPrintView } from '@/components/analysis/ReportPrintView'
import { useImageUpload } from '@/hooks/use-image-upload'
import { usePredict } from '@/hooks/use-predict'
import { useAnalysisChat } from '@/hooks/use-analysis-chat'
import { analysisService } from '@/services/analysis.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Prediction, PredictionReport } from '@/types/analysis'

/**
 * Single, centered, ChatGPT-style page: one conversation feed with a "+"
 * attach button in the input to upload a leaf photo inline, rather than a
 * separate upload box + side-panel chat. The prediction result and its
 * "related knowledge" section render as messages in the feed itself (see
 * ChatPanel/PredictionResultCard).
 */
export default function HomePage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null)
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(
    null,
  )
  const [latestReport, setLatestReport] = useState<PredictionReport | null>(
    null,
  )
  const [latestImageUrl, setLatestImageUrl] = useState<string | null>(null)
  const [inspector, setInspector] = useState<{
    open: boolean
    predictionId: string | null
    tab: InspectorTab
  }>({ open: false, predictionId: null, tab: 'explainability' })

  const { upload, isUploading, progress: uploadProgress } = useImageUpload()
  const { predict, isPredicting } = usePredict()
  const chat = useAnalysisChat(
    latestPrediction?.id ?? '',
    latestPrediction?.imageId,
  )
  const queryClient = useQueryClient()

  const isAnalyzing = isUploading || isPredicting
  const uploadingItemIdRef = useRef<string | null>(null)

  // Mirrors the upload hook's live percentage onto whichever feed item is
  // currently mid-upload — the hook itself only tracks a single in-flight
  // value, which is sufficient since attach/replace are both disabled
  // while an upload or prediction is already running.
  useEffect(() => {
    if (!isUploading || !uploadingItemIdRef.current) return
    updateImageItem(uploadingItemIdRef.current, { progress: uploadProgress })
  }, [uploadProgress, isUploading])

  function updateImageItem(
    id: string,
    patch: Partial<Extract<FeedItem, { type: 'image' }>>,
  ) {
    setFeed((prev) =>
      prev.map((item) =>
        item.id === id && item.type === 'image' ? { ...item, ...patch } : item,
      ),
    )
  }

  /** Shared by attach and replace — runs upload -> predict against an
   * already-inserted feed item, unchanged from the original prediction
   * pipeline (same hooks, same request shape). */
  async function runAnalysis(imageItemId: string, file: File) {
    uploadingItemIdRef.current = imageItemId
    try {
      updateImageItem(imageItemId, { status: 'uploading', progress: 0 })
      const image = await upload(file)
      uploadingItemIdRef.current = null

      updateImageItem(imageItemId, {
        status: 'analyzing',
        progress: undefined,
        backendImageId: image.id,
      })
      const prediction = await predict({ imageId: image.id })

      setLatestPrediction(prediction)
      updateImageItem(imageItemId, { status: 'done' })
      setFeed((prev) => [
        ...prev,
        { type: 'prediction', id: crypto.randomUUID(), prediction },
      ])

      // A new prediction changes both History and Saved Reports (the new
      // entry should appear in the former, and both lists show is_saved
      // state) — without this, either list would keep showing pre-analysis
      // data until manually reloaded.
      void queryClient.invalidateQueries({ queryKey: ['analysis', 'history'] })
      void queryClient.invalidateQueries({
        queryKey: ['analysis', 'saved-reports'],
      })

      // Fetched once here (not just lazily inside the card) so the print
      // view has real report data available as soon as one exists — and
      // written into the query cache under the same key PredictionResultCard
      // /SourcesTab read from, so their own useQuery hits this cached value
      // instead of firing a second, redundant request for the same report.
      try {
        const report = await analysisService.getPredictionReport(prediction.id)
        setLatestReport(report)
        queryClient.setQueryData(
          ['analysis', 'prediction-report', prediction.id],
          report,
        )
      } catch {
        // Non-fatal — PredictionResultCard's own collapsible section will
        // retry this fetch when expanded.
      }
    } catch (error) {
      uploadingItemIdRef.current = null
      const message = getApiErrorMessage(error, 'Unable to analyze this image.')
      updateImageItem(imageItemId, { status: 'error', errorMessage: message })
      toast.error(message)
    }
  }

  /** Selecting an image (via the "+" button or the empty-state dropzone)
   * only stages it as an attachment preview above the input — it isn't
   * uploaded, isn't sent to prediction, and doesn't appear in the
   * conversation until the user presses Send. */
  function handleAttachImage(file: File) {
    setPendingAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl: URL.createObjectURL(file) }
    })
  }

  function handleRemovePendingAttachment() {
    setPendingAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function handleReplaceImage(imageItemId: string, file: File) {
    const previewUrl = URL.createObjectURL(file)

    // Revoke the item's previous blob URL — without this, every "Replace
    // photo" action leaked one object URL for the rest of the tab's life.
    setFeed((prev) => {
      const existing = prev.find(
        (item) => item.id === imageItemId && item.type === 'image',
      )
      if (existing?.type === 'image') URL.revokeObjectURL(existing.previewUrl)
      return prev.map((item) =>
        item.id === imageItemId && item.type === 'image'
          ? {
              ...item,
              previewUrl,
              filename: file.name,
              sizeBytes: file.size,
              status: 'uploading' as const,
              progress: 0,
              errorMessage: undefined,
            }
          : item,
      )
    })
    setLatestImageUrl(previewUrl)

    await runAnalysis(imageItemId, file)
  }

  function handleRemoveImage(imageItemId: string) {
    const removed = feed.find(
      (item) => item.id === imageItemId && item.type === 'image',
    )
    if (!removed) return

    setFeed((prev) => prev.filter((item) => item.id !== imageItemId))

    toast('Photo removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          setFeed((prev) => {
            if (prev.some((item) => item.id === imageItemId)) return prev
            return [...prev, removed]
          })
        },
      },
    })
  }

  function handleSendMessage(message: string) {
    if (pendingAttachment) {
      const { file, previewUrl } = pendingAttachment
      const imageItemId = crypto.randomUUID()

      setPendingAttachment(null)
      setFeed((prev) => [
        ...prev,
        {
          type: 'image',
          id: imageItemId,
          previewUrl,
          filename: file.name,
          sizeBytes: file.size,
          status: 'uploading',
          progress: 0,
        },
      ])
      setLatestImageUrl(previewUrl)

      void runAnalysis(imageItemId, file)
      return
    }

    void chat.sendMessage(message)
  }

  const combinedFeed: FeedItem[] = useMemo(
    () => [
      ...feed,
      ...chat.messages.map((message): FeedItem => ({
        type: 'message',
        id: message.id,
        message,
      })),
    ],
    [feed, chat.messages],
  )

  const inspectorPlantName = useMemo(() => {
    const inspectorPrediction = combinedFeed.find(
      (item) =>
        item.type === 'prediction' &&
        item.prediction.id === inspector.predictionId,
    )
    return inspectorPrediction?.type === 'prediction'
      ? inspectorPrediction.prediction.plantName
      : ''
  }, [combinedFeed, inspector.predictionId])

  function handleOpenInspector(predictionId: string, tab: InspectorTab) {
    setInspector({ open: true, predictionId, tab })
  }

  const isFeedEmpty = combinedFeed.length === 0

  return (
    <div className="flex h-[calc(100svh-3.5rem-3rem)] flex-col gap-6">
      {!isFeedEmpty ? (
        <div className="print:hidden">
          <PageHeader
            title="New Analysis"
            description={
              latestPrediction
                ? `Identified as ${latestPrediction.plantName}. Ask about its medicinal properties, safety, or traditional uses.`
                : 'Attach a leaf photo to identify the plant and ask questions about it.'
            }
            actions={
              latestPrediction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                >
                  <Printer />
                  Download PDF
                </Button>
              ) : null
            }
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-0">
        <ChatPanel
          feed={combinedFeed}
          isSending={chat.isSending}
          onSendMessage={handleSendMessage}
          onAttachImage={handleAttachImage}
          onReplaceImage={(id, file) => void handleReplaceImage(id, file)}
          onRemoveImage={handleRemoveImage}
          onOpenInspector={handleOpenInspector}
          attachDisabled={isAnalyzing}
          className="min-h-0 flex-1 print:hidden"
          pendingAttachment={pendingAttachment}
          onRemovePendingAttachment={handleRemovePendingAttachment}
        />

        <AnalysisInspector
          open={inspector.open}
          onOpenChange={(open) => setInspector((prev) => ({ ...prev, open }))}
          tab={inspector.tab}
          onTabChange={(tab) => setInspector((prev) => ({ ...prev, tab }))}
          predictionId={inspector.predictionId}
          plantName={inspectorPlantName}
          className="print:hidden"
        />
      </div>

      {latestPrediction && latestReport ? (
        <ReportPrintView
          prediction={latestPrediction}
          report={latestReport}
          imageUrl={latestImageUrl}
          messages={chat.messages}
        />
      ) : null}
    </div>
  )
}
