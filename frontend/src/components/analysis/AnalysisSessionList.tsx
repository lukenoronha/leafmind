import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import type { AnalysisSession } from '@/types/analysis'
import { ROUTES } from '@/routes/paths'

interface AnalysisSessionListProps {
  sessions: AnalysisSession[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  emptyTitle: string
  emptyDescription: string
}

export function AnalysisSessionList({
  sessions,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
}: AnalysisSessionListProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load"
        description="We couldn't load your analyses. Please try again."
        onRetry={onRetry}
      />
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel="Start a new analysis"
        onAction={() => navigate(ROUTES.home)}
      />
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <Link key={session.id} to={ROUTES.home}>
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="flex items-center gap-4">
              <img
                src={session.image.url}
                alt={session.prediction.plantName}
                className="size-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground truncate font-medium">
                    {session.prediction.plantName}
                  </p>
                  {session.saved ? (
                    <Badge variant="secondary">
                      <Bookmark />
                      Saved
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-sm italic">
                  {session.prediction.scientificName}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="text-muted-foreground text-xs">
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
                <span className="text-foreground text-sm font-medium">
                  {Math.round(session.prediction.confidence * 100)}%
                </span>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
