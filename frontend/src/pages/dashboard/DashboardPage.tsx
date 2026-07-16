import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BookMarked,
  Bookmark,
  ChevronRight,
  Database,
  History,
  Leaf,
  MessageSquareText,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/components/user-hub/RoleBadge'
import { useAuth } from '@/hooks/use-auth'
import { useAnalysisHistory, useSavedReports } from '@/hooks/use-analysis-history'
import { useUserStats } from '@/hooks/use-user-stats'
import { useChatHistory } from '@/hooks/use-chat-history'
import { useRagStatus } from '@/hooks/use-rag-status'
import { ROUTES } from '@/routes/paths'

function formatMemberSince(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

const fadeInUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

/**
 * Central workspace overview. Every number here is either read straight from
 * an existing React Query cache (history, saved reports, RAG status) or
 * localStorage (chat history), or shown as "—"/"Coming soon" when no real
 * data source exists yet (e.g. per-user model insights, system health) —
 * same "never fabricate" policy as Help/Settings.
 */
export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion()
  const { user } = useAuth()
  const navigate = useNavigate()

  const {
    data: history,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useAnalysisHistory()
  const {
    data: savedReports,
    isLoading: isSavedReportsLoading,
    isError: isSavedReportsError,
    refetch: refetchSavedReports,
  } = useSavedReports()
  const { stats, isLoading: isStatsLoading } = useUserStats()
  const { conversations } = useChatHistory()
  const {
    data: ragStatus,
    isLoading: isRagLoading,
    isError: isRagError,
    refetch: refetchRag,
  } = useRagStatus()

  const recentActivity = useMemo(() => history?.slice(0, 5) ?? [], [history])
  const latestReports = useMemo(
    () => savedReports?.slice(0, 5) ?? [],
    [savedReports],
  )
  const recentChats = useMemo(() => conversations.slice(0, 5), [conversations])

  const memberSince = formatMemberSince(user?.memberSince)

  const containerMotion = prefersReducedMotion
    ? {}
    : {
        initial: 'hidden' as const,
        animate: 'show' as const,
        variants: {
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        },
      }
  const sectionMotion = prefersReducedMotion ? {} : { variants: fadeInUp }

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-275 space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your LeafMind activity."
      />

      <motion.div {...containerMotion} className="space-y-4">
        {/* 1. Overview cards — reuses useUserStats, same source as User Hub */}
        <motion.div {...sectionMotion}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((stat) => (
              <SectionCard key={stat.label} className="gap-2 py-4">
                <div className="px-5">
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                  <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                    {isStatsLoading ? (
                      <Skeleton className="h-7 w-12" />
                    ) : stat.available && stat.value !== null ? (
                      stat.label === 'Average Confidence' ? (
                        `${stat.value}%`
                      ) : (
                        stat.value
                      )
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </p>
                </div>
              </SectionCard>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 2. Recent Activity */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Recent Activity"
              description="Your latest plant identifications."
              action={
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                  <Link to={ROUTES.history}>
                    View all
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              {isHistoryLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : isHistoryError ? (
                <ErrorState
                  title="Unable to load"
                  description="We couldn't load your recent activity."
                  onRetry={() => void refetchHistory()}
                  className="py-6"
                />
              ) : recentActivity.length === 0 ? (
                <EmptyState
                  icon={Leaf}
                  title="No analyses yet"
                  description="Identify your first plant to see it here."
                  actionLabel="Start a new analysis"
                  onAction={() => navigate(ROUTES.home)}
                  className="py-6"
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recentActivity.map((session) => (
                    <li key={session.id}>
                      <Link
                        to={ROUTES.home}
                        className="hover:bg-muted/50 -mx-5 flex items-center gap-3 px-5 py-2.5 transition-colors"
                      >
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <Leaf className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-medium">
                            {session.prediction.plantName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">
                          {Math.round(session.prediction.confidence * 100)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </motion.div>

          {/* 3. Latest Reports */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Latest Reports"
              description="Your saved identification reports."
              action={
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                  <Link to={ROUTES.savedReports}>
                    View all
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              {isSavedReportsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : isSavedReportsError ? (
                <ErrorState
                  title="Unable to load"
                  description="We couldn't load your saved reports."
                  onRetry={() => void refetchSavedReports()}
                  className="py-6"
                />
              ) : latestReports.length === 0 ? (
                <EmptyState
                  icon={Bookmark}
                  title="No saved reports yet"
                  description="Save an identification to find it here."
                  className="py-6"
                />
              ) : (
                <ul className="divide-border divide-y">
                  {latestReports.map((session) => (
                    <li key={session.id}>
                      <Link
                        to={ROUTES.home}
                        className="hover:bg-muted/50 -mx-5 flex items-center gap-3 px-5 py-2.5 transition-colors"
                      >
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <Bookmark className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-medium">
                            {session.prediction.plantName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">
                          {Math.round(session.prediction.confidence * 100)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </motion.div>

          {/* 4. Recent Chat Sessions — localStorage-backed, same source as Chat History page */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Recent Chat Sessions"
              description="Conversations about your identified plants."
              action={
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                  <Link to={ROUTES.chatHistory}>
                    View all
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              {recentChats.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="No conversations yet"
                  description="Ask a question after your next identification."
                  className="py-6"
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recentChats.map((conversation) => (
                    <li key={conversation.predictionId}>
                      <Link
                        to={ROUTES.home}
                        className="hover:bg-muted/50 -mx-5 flex items-center gap-3 px-5 py-2.5 transition-colors"
                      >
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <MessageSquareText className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-medium">
                            {conversation.plantName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {conversation.messageCount} message
                            {conversation.messageCount === 1 ? '' : 's'} ·{' '}
                            {new Date(conversation.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </motion.div>

          {/* 5. Model Insights — per-user analytics require backend aggregation
              that doesn't exist yet (developer-only endpoints aggregate across
              all users, not scoped to the current user), so this stays
              Coming Soon rather than showing someone else's numbers. */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Model Insights"
              description="How the identification model has performed for you."
            >
              <EmptyState
                icon={Sparkles}
                title="Coming soon"
                description="Personalized model insights aren't available yet — this needs per-user analytics the backend doesn't aggregate today."
                className="py-6"
              />
            </SectionCard>
          </motion.div>
        </div>

        {/* 6. Knowledge Base — real data from GET /rag/status */}
        <motion.div {...sectionMotion}>
          <SectionCard
            title="Knowledge Base"
            description="The reference library LeafMind uses to ground its answers."
          >
            {isRagLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : isRagError ? (
              <ErrorState
                title="Unable to load"
                description="We couldn't load the knowledge base status."
                onRetry={() => void refetchRag()}
                className="py-6"
              />
            ) : ragStatus ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-muted-foreground text-xs">Documents indexed</p>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {ragStatus.indexedDocuments}
                    <span className="text-muted-foreground text-sm font-normal">
                      {' '}
                      / {ragStatus.totalDocuments}
                    </span>
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-muted-foreground text-xs">Chunks</p>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {ragStatus.totalChunks.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-muted-foreground text-xs">Embedding model</p>
                  <p className="text-foreground truncate text-sm font-semibold">
                    {ragStatus.embeddingModel}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-muted-foreground text-xs">Vector store</p>
                  <p className="text-foreground text-sm font-semibold">
                    {ragStatus.vectorStoreReady ? (
                      <Badge variant="secondary" className="text-[0.7rem]">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[0.7rem]">
                        Not ready
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </motion.div>

        {/* 7. Quick Actions */}
        <motion.div {...sectionMotion}>
          <SectionCard title="Quick Actions">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionTile
                icon={Sparkles}
                label="New Analysis"
                onClick={() => navigate(ROUTES.home)}
              />
              <QuickActionTile
                icon={History}
                label="View History"
                onClick={() => navigate(ROUTES.history)}
              />
              <QuickActionTile
                icon={BookMarked}
                label="Saved Reports"
                onClick={() => navigate(ROUTES.savedReports)}
              />
              <QuickActionTile
                icon={Settings}
                label="Settings"
                onClick={() => navigate(ROUTES.settings)}
              />
            </div>
          </SectionCard>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 8. Account Summary */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="Account Summary"
              description="Your LeafMind account at a glance."
              action={
                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                  <Link to={ROUTES.user}>
                    View profile
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="text-foreground font-medium">{user.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="text-foreground truncate font-medium">
                    {user.email}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>
                    <RoleBadge role={user.role} className="px-1.5 py-0 text-[0.65rem]" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="text-foreground font-medium">
                    {memberSince ?? '—'}
                  </dd>
                </div>
              </dl>
            </SectionCard>
          </motion.div>

          {/* 9. System Status — admin/developer system health endpoints are
              role-gated and reflect global infra, not this user's account, so
              they're intentionally omitted here rather than shown to everyone
              or duplicated from the Admin/Developer pages. */}
          <motion.div {...sectionMotion}>
            <SectionCard
              title="System Status"
              description="LeafMind service health."
            >
              <EmptyState
                icon={Database}
                title="Coming soon"
                description="Live system status isn't available to all accounts yet — detailed health is currently only visible on the Admin and Developer pages."
                className="py-6"
              />
            </SectionCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

function QuickActionTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof UserRound
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2"
    >
      <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <span className="text-foreground text-sm font-medium">{label}</span>
    </button>
  )
}
