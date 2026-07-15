import { useUserStats } from '@/hooks/use-user-stats'

/**
 * One compact horizontal grid, reusing the User Hub's stats source
 * (use-user-stats): real counts come from GET /history and
 * GET /saved-reports; stats with no backend aggregate yet ("Questions
 * Asked", "Bookmarks") render an em-dash instead of a fabricated zero.
 */
export function UsageStatsGrid() {
  const { stats, isLoading } = useUserStats()

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-muted/40 rounded-lg border border-transparent px-3 py-2 text-center"
        >
          <dd className="text-foreground text-lg leading-tight font-semibold tabular-nums">
            {isLoading ? (
              <span className="bg-muted-foreground/20 mx-auto inline-block h-5 w-8 animate-pulse rounded" />
            ) : stat.available && stat.value !== null ? (
              stat.label === 'Average Confidence' ? (
                `${stat.value}%`
              ) : (
                stat.value
              )
            ) : (
              <span
                className="text-muted-foreground/60 text-base"
                title="Available after backend integration"
              >
                —
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground truncate text-[0.7rem] leading-tight">
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  )
}
