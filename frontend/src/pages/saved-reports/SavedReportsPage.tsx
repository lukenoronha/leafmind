import { PageHeader } from '@/components/common/PageHeader'
import { AnalysisSessionList } from '@/components/analysis/AnalysisSessionList'
import { useSavedReports } from '@/hooks/use-analysis-history'

export default function SavedReportsPage() {
  const { data, isLoading, isError, refetch } = useSavedReports()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Reports"
        description="Health reports you've bookmarked for later reference."
      />
      <AnalysisSessionList
        sessions={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No saved reports"
        emptyDescription="Save a health report from an analysis to find it here."
      />
    </div>
  )
}
