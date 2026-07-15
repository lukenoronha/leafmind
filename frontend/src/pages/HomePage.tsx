import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ChatPanel, type FeedItem } from '@/components/analysis/chat/ChatPanel'
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

      // Fetched once here (not just lazily inside the card) so the print
      // view has real report data available as soon as one exists.
      try {
        const report = await analysisService.getPredictionReport(prediction.id)
        setLatestReport(report)
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

  async function handleAttachImage(file: File) {
    const previewUrl = URL.createObjectURL(file)
    const imageItemId = crypto.randomUUID()

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

    await runAnalysis(imageItemId, file)
  }

  async function handleReplaceImage(imageItemId: string, file: File) {
    const previewUrl = URL.createObjectURL(file)
    updateImageItem(imageItemId, {
      previewUrl,
      filename: file.name,
      sizeBytes: file.size,
      status: 'uploading',
      progress: 0,
      errorMessage: undefined,
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
          onAttachImage={(file) => void handleAttachImage(file)}
          onReplaceImage={(id, file) => void handleReplaceImage(id, file)}
          onRemoveImage={handleRemoveImage}
          onOpenInspector={handleOpenInspector}
          attachDisabled={isAnalyzing}
          canSendMessage={!!latestPrediction}
          className="min-h-0 flex-1 print:hidden"
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
