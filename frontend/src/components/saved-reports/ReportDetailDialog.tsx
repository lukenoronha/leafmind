import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, FileJson } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { SourcesPanel } from '@/components/analysis/chat/SourcesPanel'
import { PredictionConfidenceBadge } from '@/components/analysis/chat/PredictionConfidenceBadge'
import { analysisService } from '@/services/analysis.service'
import { exportReportAsJson } from '@/lib/report-export'
import { ROUTES } from '@/routes/paths'
import type { AnalysisSession, Source } from '@/types/analysis'

interface ReportDetailDialogProps {
  session: AnalysisSession | null
  onOpenChange: (open: boolean) => void
  isDownloadingPdf: boolean
  onDownloadPdf: (session: AnalysisSession) => void
}

/**
 * Report detail viewer for Saved Reports / History — reuses the same
 * `getPredictionReport` query (and query key) as `PredictionResultCard`, so
 * opening a report already fetched during a live session serves from cache
 * instead of refetching. Deliberately does not reuse `PredictionResultCard`
 * itself: that component requires a live `imageUrl` blob and an
 * `onOpenInspector` callback tied to the in-session chat feed, neither of
 * which exist for a persisted report — but every field it shows is mirrored
 * here from the same real data (no fabricated scientific name/summary).
 */
export function ReportDetailDialog({
  session,
  onOpenChange,
  isDownloadingPdf,
  onDownloadPdf,
}: ReportDetailDialogProps) {
  const report = useQuery({
    queryKey: ['analysis', 'prediction-report', session?.id],
    queryFn: () => analysisService.getPredictionReport(session!.id),
    enabled: !!session,
  })

  const knowledgeAsSources: Source[] =
    report.data?.relatedKnowledge.map((chunk, index) => ({
      chunkId: `${session?.id}-${index}`,
      documentId: `${session?.id}-${index}`,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
      chapter: chunk.chapter,
      score: chunk.score,
      text: chunk.text,
    })) ?? []

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {session ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-6">
                <DialogTitle>{session.prediction.plantName}</DialogTitle>
                <PredictionConfidenceBadge value={session.prediction.confidence} />
              </div>
              <DialogDescription>
                Identified {new Date(session.createdAt).toLocaleString()} from{' '}
                {session.image.originalFilename}
              </DialogDescription>
            </DialogHeader>

            {session.prediction.status === 'low_confidence' ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  This identification was flagged as low-confidence — verify
                  carefully before relying on it.
                </span>
              </div>
            ) : null}

            {report.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : report.isError ? (
              <ErrorState
                title="Unable to load report"
                description="We couldn't load the medicinal knowledge for this report."
                onRetry={() => void report.refetch()}
                className="py-6"
              />
            ) : (
              <>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {report.data?.disclaimer}
                </p>
                {report.data?.knowledgeAvailable ? (
                  <SourcesPanel sources={knowledgeAsSources} />
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No information about this species is available in the
                    knowledge base yet.
                  </p>
                )}
              </>
            )}

            <DialogFooter className="flex-row flex-wrap items-center justify-end gap-2 sm:justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link to={ROUTES.home}>Open Analysis</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloadingPdf}
                onClick={() => onDownloadPdf(session)}
              >
                <Download className="size-3.5" />
                {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!report.data}
                onClick={() =>
                  report.data && exportReportAsJson(session, report.data)
                }
              >
                <FileJson className="size-3.5" />
                Export JSON
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
