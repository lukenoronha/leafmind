import { useMemo } from 'react'
import { useAnalysisHistory, useSavedReports } from '@/hooks/use-analysis-history'

export interface UserStat {
  label: string
  /** Omitted (rather than 0) when there's no real data source yet — the
   * caller renders a "coming soon" placeholder instead of a fabricated
   * number. See backend TODOs in the User Hub summary. */
  value: number | null
  available: boolean
}

/**
 * Derives what it can from real, already-fetched backend data (History and
 * Saved Reports both come from GET /history and GET /saved-reports) rather
 * than inventing numbers. "Questions Asked" and "Bookmarks" have no backend
 * concept at all yet (chat lives only in localStorage per prediction, and
 * `AnalysisSession.saved` is hardcoded false — see types/analysis.ts), so
 * they're reported as unavailable instead of guessed.
 */
export function useUserStats() {
  const { data: history, isLoading: isHistoryLoading } = useAnalysisHistory()
  const { data: savedReports, isLoading: isSavedReportsLoading } =
    useSavedReports()

  const isLoading = isHistoryLoading || isSavedReportsLoading

  const stats = useMemo<UserStat[]>(() => {
    const plantsIdentified = history?.length ?? null
    const savedReportsCount = savedReports?.length ?? null

    const confidences = history?.map((item) => item.prediction.confidence) ?? []
    const averageConfidence =
      confidences.length > 0
        ? Math.round(
            (confidences.reduce((sum, value) => sum + value, 0) /
              confidences.length) *
              100,
          )
        : null

    return [
      {
        label: 'Plants Identified',
        value: plantsIdentified,
        available: history !== undefined,
      },
      {
        label: 'Saved Reports',
        value: savedReportsCount,
        available: savedReports !== undefined,
      },
      {
        label: 'Average Confidence',
        value: averageConfidence,
        available: confidences.length > 0,
      },
      // No backend endpoint aggregates chat message counts or bookmarks
      // across a user's history — chat threads only exist in per-browser
      // localStorage (see use-chat-history.ts), and "bookmark" isn't a
      // real concept server-side (AnalysisSession.saved is always false).
      { label: 'Questions Asked', value: null, available: false },
      { label: 'Bookmarks', value: null, available: false },
    ]
  }, [history, savedReports])

  return { stats, isLoading }
}
