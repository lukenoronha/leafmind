import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { History as HistoryIcon, Search } from 'lucide-react'
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
import { HistoryCard } from '@/components/history/HistoryCard'
import {
  useAnalysisHistory,
  useSetSaved,
  useDeletePrediction,
} from '@/hooks/use-analysis-history'
import { analysisService } from '@/services/analysis.service'
import { exportReportAsJson, downloadReportPdf } from '@/lib/report-export'
import { getApiErrorMessage } from '@/lib/api-error'
import { ROUTES, analysisSessionRoute } from '@/routes/paths'
import type { AnalysisSession } from '@/types/analysis'

type SortOption = 'newest' | 'oldest' | 'confidence-desc' | 'confidence-asc' | 'plant-name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'confidence-desc', label: 'Highest confidence' },
  { value: 'confidence-asc', label: 'Lowest confidence' },
  { value: 'plant-name', label: 'Plant name (A–Z)' },
]

type SavedFilter = 'all' | 'saved' | 'unsaved'
type ConfidenceFilter = 'all' | 'high' | 'needs-review'

const SAVED_FILTER_OPTIONS: { value: SavedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'unsaved', label: 'Unsaved' },
]

const CONFIDENCE_FILTER_OPTIONS: { value: ConfidenceFilter; label: string }[] = [
  { value: 'all', label: 'All confidence' },
  { value: 'high', label: 'Confident only' },
  { value: 'needs-review', label: 'Needs review' },
]

/**
 * History — reuses `useAnalysisHistory()` (GET /history) as the sole data
 * source, same as Saved Reports reuses `useSavedReports()`. Search/sort/
 * filter are client-side for the same reason as Saved Reports: the backend
 * has no search/sort/status query params on /history (only `saved`), and a
 * single user's history is small enough that client-side filtering avoids
 * adding backend surface for no real benefit. "Open Session" reopens the
 * full original analysis (prediction + report + conversation) via the new
 * /analysis/:predictionId route — see AnalysisSessionPage.
 */
export default function HistoryPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useAnalysisHistory()
  const setSavedMutation = useSetSaved()
  const deleteMutation = useDeletePrediction()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')

  const [pendingDelete, setPendingDelete] = useState<AnalysisSession | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const filteredSorted = useMemo(() => {
    if (!data) return []

    const query = search.trim().toLowerCase()
    let result = data.filter((session) =>
      query ? session.prediction.plantName.toLowerCase().includes(query) : true,
    )

    if (savedFilter === 'saved') {
      result = result.filter((s) => s.saved)
    } else if (savedFilter === 'unsaved') {
      result = result.filter((s) => !s.saved)
    }

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
      case 'confidence-asc':
        sorted.sort((a, b) => a.prediction.confidence - b.prediction.confidence)
        break
      case 'plant-name':
        sorted.sort((a, b) =>
          a.prediction.plantName.localeCompare(b.prediction.plantName),
        )
        break
    }
    return sorted
  }, [data, search, savedFilter, confidenceFilter, sort])

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

  function handleToggleSaved(session: AnalysisSession) {
    setSavedMutation.mutate(
      { predictionId: session.id, isSaved: !session.saved },
      {
        onSuccess: () =>
          toast.success(
            session.saved
              ? `Removed "${session.prediction.plantName}" from Saved Reports.`
              : `Saved "${session.prediction.plantName}".`,
          ),
        onError: (error) =>
          toast.error(getApiErrorMessage(error, "Couldn't update saved status.")),
      },
    )
  }

  function handleDelete() {
    if (!pendingDelete) return
    const session = pendingDelete
    deleteMutation.mutate(session.id, {
      onSuccess: () => toast.success(`Deleted "${session.prediction.plantName}".`),
      onError: (error) =>
        toast.error(getApiErrorMessage(error, "Couldn't delete this analysis.")),
    })
    setPendingDelete(null)
  }

  const hasAnyHistory = (data?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Every plant you've analyzed with LeafMind."
      />

      {hasAnyHistory ? (
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
              aria-label="Search history"
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Sort history">
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
            value={savedFilter}
            onValueChange={(v) => setSavedFilter(v as SavedFilter)}
          >
            <SelectTrigger className="w-full sm:w-32" aria-label="Filter history by saved status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAVED_FILTER_OPTIONS.map((option) => (
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
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter history by confidence">
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
          description="We couldn't load your analysis history. Please try again."
          onRetry={() => void refetch()}
        />
      ) : !hasAnyHistory ? (
        <EmptyState
          icon={HistoryIcon}
          title="No analysis history"
          description="Start your first plant identification."
          actionLabel="New Analysis"
          onAction={() => navigate(ROUTES.home)}
        />
      ) : filteredSorted.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching analyses"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((session) => (
            <HistoryCard
              key={session.id}
              session={session}
              onOpenSession={(s) => navigate(analysisSessionRoute(s.id))}
              onDownloadPdf={handleDownloadPdf}
              onExportJson={handleExportJson}
              onToggleSaved={handleToggleSaved}
              onDelete={setPendingDelete}
              isDownloadingPdf={downloadingId === session.id}
              isExportingJson={exportingId === session.id}
            />
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this analysis?"
        description="This permanently removes the prediction and its report. This action cannot be undone."
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
