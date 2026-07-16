import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bookmark, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SavedReportCard } from '@/components/saved-reports/SavedReportCard'
import { ReportDetailDialog } from '@/components/saved-reports/ReportDetailDialog'
import {
  useSavedReports,
  useSetSaved,
  useDeletePrediction,
} from '@/hooks/use-analysis-history'
import { analysisService } from '@/services/analysis.service'
import { exportReportAsJson, downloadReportPdf } from '@/lib/report-export'
import { getApiErrorMessage } from '@/lib/api-error'
import { ROUTES, analysisSessionRoute } from '@/routes/paths'
import type { AnalysisSession } from '@/types/analysis'

type SortOption =
  | 'newest'
  | 'oldest'
  | 'confidence-desc'
  | 'plant-name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'confidence-desc', label: 'Highest confidence' },
  { value: 'plant-name', label: 'Plant name (A–Z)' },
]

type ConfidenceFilter = 'all' | 'high' | 'needs-review'

const CONFIDENCE_FILTER_OPTIONS: { value: ConfidenceFilter; label: string }[] = [
  { value: 'all', label: 'All confidence' },
  { value: 'high', label: 'Confident only' },
  { value: 'needs-review', label: 'Needs review' },
]

/**
 * Saved Reports — reuses `useSavedReports()` (GET /history?saved=true) as
 * the sole data source. Search/sort/filter are all client-side: the backend
 * has no search/sort query params on /history (confirmed by audit), and a
 * single user's saved-reports list is small enough that fetching everything
 * once and filtering client-side avoids adding backend surface for no real
 * benefit. Filters are limited to fields that actually exist on
 * AnalysisSession (confidence, plant name, date) — no fabricated metadata
 * (no scientific name, family, or role filters, none of which the backend
 * provides for this data).
 */
export default function SavedReportsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useSavedReports()
  const setSavedMutation = useSetSaved()
  const deleteMutation = useDeletePrediction()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')

  const [viewing, setViewing] = useState<AnalysisSession | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AnalysisSession | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const filteredSorted = useMemo(() => {
    if (!data) return []

    const query = search.trim().toLowerCase()
    let result = data.filter((session) =>
      query ? session.prediction.plantName.toLowerCase().includes(query) : true,
    )

    if (confidenceFilter === 'high') {
      result = result.filter((s) => s.prediction.status !== 'low_confidence')
    } else if (confidenceFilter === 'needs-review') {
      result = result.filter((s) => s.prediction.status === 'low_confidence')
    }

    const sorted = [...result]
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      case 'oldest':
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        break
      case 'confidence-desc':
        sorted.sort((a, b) => b.prediction.confidence - a.prediction.confidence)
        break
      case 'plant-name':
        sorted.sort((a, b) =>
          a.prediction.plantName.localeCompare(b.prediction.plantName),
        )
        break
    }
    return sorted
  }, [data, search, confidenceFilter, sort])

  async function handleDownloadPdf(session: AnalysisSession) {
    setDownloadingId(session.id)
    try {
      const blob = await analysisService.getPredictionReportPdf(session.id)
      downloadReportPdf(blob, session.id)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't download the PDF report."))
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleExportJson(session: AnalysisSession) {
    setExportingId(session.id)
    try {
      const report = await analysisService.getPredictionReport(session.id)
      exportReportAsJson(session, report)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't export the report."))
    } finally {
      setExportingId(null)
    }
  }

  function handleUnsave(session: AnalysisSession) {
    setSavedMutation.mutate(
      { predictionId: session.id, isSaved: false },
      {
        onSuccess: () => toast.success(`Removed "${session.prediction.plantName}" from Saved Reports.`),
        onError: (error) =>
          toast.error(getApiErrorMessage(error, "Couldn't unsave this report.")),
      },
    )
  }

  function handleDelete() {
    if (!pendingDelete) return
    const session = pendingDelete
    deleteMutation.mutate(session.id, {
      onSuccess: () => {
        toast.success(`Deleted "${session.prediction.plantName}".`)
        if (viewing?.id === session.id) setViewing(null)
      },
      onError: (error) =>
        toast.error(getApiErrorMessage(error, "Couldn't delete this report.")),
    })
    setPendingDelete(null)
  }

  const hasAnySaved = (data?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Reports"
        description="Health reports you've bookmarked for later reference."
      />

      {hasAnySaved ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              placeholder="Search by plant name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search saved reports"
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Sort saved reports">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={confidenceFilter}
            onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter saved reports by confidence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONFIDENCE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load"
          description="We couldn't load your saved reports. Please try again."
          onRetry={() => void refetch()}
        />
      ) : !hasAnySaved ? (
        <EmptyState
          icon={Bookmark}
          title="No saved reports"
          description="Save prediction reports to access them later."
          actionLabel="Go to New Analysis"
          onAction={() => navigate(ROUTES.home)}
        />
      ) : filteredSorted.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching reports"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((session) => (
            <SavedReportCard
              key={session.id}
              session={session}
              onOpenReport={setViewing}
              onOpenAnalysis={(s) => navigate(analysisSessionRoute(s.id))}
              onDownloadPdf={handleDownloadPdf}
              onExportJson={handleExportJson}
              onUnsave={handleUnsave}
              onDelete={setPendingDelete}
              isDownloadingPdf={downloadingId === session.id}
              isExportingJson={exportingId === session.id}
            />
          ))}
        </div>
      )}

      <ReportDetailDialog
        session={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        isDownloadingPdf={!!viewing && downloadingId === viewing.id}
        onDownloadPdf={handleDownloadPdf}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this report?"
        description="This permanently removes the prediction and its report. This action cannot be undone."
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
