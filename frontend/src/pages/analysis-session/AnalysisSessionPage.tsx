import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, FileJson, Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatPanel, type FeedItem } from '@/components/analysis/chat/ChatPanel'
import {
  AnalysisInspector,
  type InspectorTab,
} from '@/components/analysis/inspector/AnalysisInspector'
import { ReportPrintView } from '@/components/analysis/ReportPrintView'
import { usePredictionDetail } from '@/hooks/use-analysis-session'
import { useAnalysisChat } from '@/hooks/use-analysis-chat'
import { useSetSaved, useDeletePrediction } from '@/hooks/use-analysis-history'
import { analysisService } from '@/services/analysis.service'
import { exportReportAsJson, downloadReportPdf } from '@/lib/report-export'
import { getApiErrorMessage } from '@/lib/api-error'
import { ROUTES } from '@/routes/paths'
import type { Prediction } from '@/types/analysis'

/**
 * Reopens a full past analysis session from History/Saved Reports — same
 * conversation feed UI as a live session (HomePage), built from historical
 * data instead of a fresh upload. Deliberately a separate page rather than
 * parameterizing HomePage: HomePage's state (feed/latestPrediction/
 * latestImageUrl) exists solely to drive the live upload→predict pipeline,
 * and retrofitting it to also hydrate from a predictionId would tangle two
 * very different lifecycles. This page reuses every *rendering* building
 * block HomePage uses (ChatPanel, PredictionResultCard via ChatPanel,
 * AnalysisInspector, ReportPrintView, useAnalysisChat) — nothing here is a
 * new UI, only a new way to seed the same feed shape.
 *
 * There is no original leaf photo to show — the backend never serves
 * uploaded images back by URL (see types/analysis.ts) — so the prediction
 * card's media band gracefully renders its placeholder, exactly as it
 * already does whenever `imageUrl` is null.
 */
export default function AnalysisSessionPage() {
  const { predictionId } = useParams<{ predictionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [inspector, setInspector] = useState<{
    open: boolean
    predictionId: string | null
    tab: InspectorTab
  }>({ open: false, predictionId: null, tab: 'explainability' })
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const {
    data: predictionDetail,
    isLoading: isPredictionLoading,
    isError: isPredictionError,
    refetch: refetchPrediction,
  } = usePredictionDetail(predictionId)

  const report = useQuery({
    queryKey: ['analysis', 'prediction-report', predictionId],
    queryFn: () => analysisService.getPredictionReport(predictionId!),
    enabled: !!predictionId,
  })

  const chat = useAnalysisChat(predictionId ?? '', predictionDetail?.imageId)
  const setSavedMutation = useSetSaved()
  const deleteMutation = useDeletePrediction()

  const prediction: Prediction | null = useMemo(
    () =>
      predictionDetail
        ? {
            id: predictionDetail.id,
            imageId: predictionDetail.imageId,
            plantName: predictionDetail.plantName,
            confidence: predictionDetail.confidence,
            candidates: predictionDetail.candidates,
            modelVersion: predictionDetail.modelVersion,
            preprocessingMs: predictionDetail.preprocessingMs,
            inferenceMs: predictionDetail.inferenceMs,
            predictedAt: predictionDetail.predictedAt,
            status: predictionDetail.status,
            message: predictionDetail.message,
          }
        : null,
    [predictionDetail],
  )

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = []
    if (prediction) {
      items.push({ type: 'prediction', id: prediction.id, prediction })
    }
    for (const message of chat.messages) {
      items.push({ type: 'message', id: message.id, message })
    }
    return items
  }, [prediction, chat.messages])

  const inspectorPlantName = prediction?.plantName ?? ''

  function handleOpenInspector(openPredictionId: string, tab: InspectorTab) {
    setInspector({ open: true, predictionId: openPredictionId, tab })
  }

  async function handleDownloadPdf() {
    if (!predictionId) return
    setIsDownloadingPdf(true)
    try {
      const blob = await analysisService.getPredictionReportPdf(predictionId)
      downloadReportPdf(blob, predictionId)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't download the PDF report."))
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handleExportJson() {
    if (!predictionDetail || !report.data) return
    exportReportAsJson(
      {
        id: predictionDetail.id,
        image: {
          id: predictionDetail.imageId,
          originalFilename: predictionDetail.originalFilename,
        },
        prediction: {
          id: predictionDetail.id,
          plantName: predictionDetail.plantName,
          confidence: predictionDetail.confidence,
          status: predictionDetail.status,
        },
        createdAt: predictionDetail.predictedAt,
        saved: predictionDetail.isSaved,
      },
      report.data,
    )
  }

  function handleToggleSaved() {
    if (!predictionDetail) return
    setSavedMutation.mutate(
      { predictionId: predictionDetail.id, isSaved: !predictionDetail.isSaved },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: ['analysis', 'prediction-detail', predictionDetail.id],
          })
          toast.success(
            predictionDetail.isSaved ? 'Removed from Saved Reports.' : 'Saved.',
          )
        },
        onError: (error) =>
          toast.error(getApiErrorMessage(error, "Couldn't update saved status.")),
      },
    )
  }

  function handleDelete() {
    if (!predictionDetail) return
    deleteMutation.mutate(predictionDetail.id, {
      onSuccess: () => {
        toast.success(`Deleted "${predictionDetail.plantName}".`)
        navigate(ROUTES.history)
      },
      onError: (error) =>
        toast.error(getApiErrorMessage(error, "Couldn't delete this session.")),
    })
  }

  if (isPredictionLoading) {
    return (
      <div className="mx-auto w-full max-w-160 space-y-4 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (isPredictionError || !predictionDetail) {
    return (
      <div className="mx-auto w-full max-w-160 py-6">
        <ErrorState
          title="Couldn't open this session"
          description="This analysis may have been deleted, or you may not have access to it."
          onRetry={() => void refetchPrediction()}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem-3rem)] flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title={predictionDetail.plantName}
          description={`Identified ${new Date(predictionDetail.predictedAt).toLocaleString()}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(ROUTES.history)}
              >
                <ArrowLeft />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleSaved}
                disabled={setSavedMutation.isPending}
              >
                {predictionDetail.isSaved ? 'Unsave' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadPdf()}
                disabled={isDownloadingPdf}
              >
                <Printer />
                {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={!report.data}
              >
                <FileJson />
                Export JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-0">
        <ChatPanel
          feed={feed}
          isSending={chat.isSending || chat.isHydrating}
          onSendMessage={(message) => void chat.sendMessage(message)}
          onAttachImage={() => {}}
          onReplaceImage={() => {}}
          onRemoveImage={() => {}}
          onOpenInspector={handleOpenInspector}
          attachDisabled
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

      {prediction && report.data ? (
        <ReportPrintView
          prediction={prediction}
          report={report.data}
          imageUrl={null}
          messages={chat.messages}
        />
      ) : null}
    </div>
  )
}
