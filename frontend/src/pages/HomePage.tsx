import { useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ChatPanel, type FeedItem } from '@/components/analysis/chat/ChatPanel'
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

  const { upload, isUploading } = useImageUpload()
  const { predict, isPredicting } = usePredict()
  const chat = useAnalysisChat(
    latestPrediction?.id ?? '',
    latestPrediction?.imageId,
  )

  const isAnalyzing = isUploading || isPredicting

  async function handleAttachImage(file: File) {
    const previewUrl = URL.createObjectURL(file)
    const imageItemId = crypto.randomUUID()

    setFeed((prev) => [
      ...prev,
      { type: 'image', id: imageItemId, previewUrl, isAnalyzing: true },
    ])
    setLatestImageUrl(previewUrl)

    try {
      const image = await upload(file)
      const prediction = await predict({ imageId: image.id })

      setLatestPrediction(prediction)
      setFeed((prev) => [
        ...prev.map((item) =>
          item.id === imageItemId && item.type === 'image'
            ? { ...item, isAnalyzing: false }
            : item,
        ),
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
      setFeed((prev) =>
        prev.map((item) =>
          item.id === imageItemId && item.type === 'image'
            ? { ...item, isAnalyzing: false }
            : item,
        ),
      )
      toast.error(getApiErrorMessage(error, 'Unable to analyze this image.'))
    }
  }

  function handleSendMessage(message: string) {
    void chat.sendMessage(message)
  }

  const combinedFeed: FeedItem[] = [
    ...feed,
    ...chat.messages.map(
      (message): FeedItem => ({ type: 'message', id: message.id, message }),
    ),
  ]

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      <div className="print:hidden">
        <PageHeader
          title="New Analysis"
          description="Attach a leaf photo to identify the plant and ask questions about it."
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

      <ChatPanel
        feed={combinedFeed}
        isSending={chat.isSending}
        onSendMessage={handleSendMessage}
        onAttachImage={(file) => void handleAttachImage(file)}
        attachDisabled={isAnalyzing}
        className="flex-1 print:hidden"
      />

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
