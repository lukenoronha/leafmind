import { PageHeader } from '@/components/common/PageHeader'
import { AnalysisSessionList } from '@/components/analysis/AnalysisSessionList'
import { useAnalysisHistory } from '@/hooks/use-analysis-history'

export default function HistoryPage() {
  const { data, isLoading, isError, refetch } = useAnalysisHistory()

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Every plant you've analyzed with LeafMind."
      />
      <AnalysisSessionList
        sessions={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No analyses yet"
        emptyDescription="Your identification history will appear here once you analyze a plant."
      />
    </div>
  )
}
