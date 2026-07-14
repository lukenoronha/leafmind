import { useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import {
  ImageUploader,
  type UploadStatus,
} from '@/components/analysis/ImageUploader'
import { PredictionCard } from '@/components/analysis/PredictionCard'
import { HealthReportCard } from '@/components/analysis/HealthReportCard'
import { ReportPrintView } from '@/components/analysis/ReportPrintView'
import { ChatPanel } from '@/components/analysis/chat/ChatPanel'
import { useImageUpload } from '@/hooks/use-image-upload'
import { usePredict } from '@/hooks/use-predict'
import { useAnalysisChat } from '@/hooks/use-analysis-chat'
import { analysisService } from '@/services/analysis.service'
import { getApiErrorMessage } from '@/lib/api-error'
import type { Prediction, PredictionReport } from '@/types/analysis'

export default function HomePage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<{
    prediction: Prediction
    report: PredictionReport
  } | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const { upload, isUploading, progress, reset: resetUpload } = useImageUpload()
  const { predict, isPredicting, reset: resetPredict } = usePredict()
  const chat = useAnalysisChat(
    result?.prediction.id ?? '',
    result?.prediction.imageId,
  )

  const status: UploadStatus = analysisError
    ? 'error'
    : isUploading
      ? 'uploading'
      : isPredicting
        ? 'processing'
        : 'idle'

  async function handleFileSelected(file: File) {
    setAnalysisError(null)
    setResult(null)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    try {
      const image = await upload(file)
      const prediction = await predict({ imageId: image.id })
      const report = await analysisService.getPredictionReport(prediction.id)
      setResult({ prediction, report })
    } catch (error) {
      setAnalysisError(
        getApiErrorMessage(error, 'Unable to analyze this image.'),
      )
      toast.error('Analysis failed. Please try again.')
    }
  }

  function handleClear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setResult(null)
    setAnalysisError(null)
    resetUpload()
    resetPredict()
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="New Analysis"
          description="Upload a leaf photo to identify the plant and get a medicinal health report."
          actions={
            result ? (
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:hidden">
        <div className="space-y-6">
          <ImageUploader
            status={status}
            progress={progress}
            errorMessage={analysisError ?? undefined}
            previewUrl={previewUrl}
            onFileSelected={handleFileSelected}
            onClear={handleClear}
          />

          {analysisError ? (
            <ErrorState
              title="Analysis failed"
              description={analysisError}
              onRetry={handleClear}
            />
          ) : null}

          {result ? <PredictionCard prediction={result.prediction} /> : null}
          {result ? <HealthReportCard report={result.report} /> : null}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {result ? (
            <ChatPanel
              plantName={result.prediction.plantName}
              messages={chat.messages}
              isSending={chat.isSending}
              onSendMessage={chat.sendMessage}
              className="h-[calc(100vh-14rem)] min-h-112"
            />
          ) : (
            <div className="text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed text-center text-sm lg:h-[calc(100vh-14rem)] lg:min-h-112">
              Upload a plant photo to start a conversation about it.
            </div>
          )}
        </div>
      </div>

      {result ? (
        <ReportPrintView
          prediction={result.prediction}
          report={result.report}
          imageUrl={previewUrl}
          messages={chat.messages}
        />
      ) : null}
    </div>
  )
}
