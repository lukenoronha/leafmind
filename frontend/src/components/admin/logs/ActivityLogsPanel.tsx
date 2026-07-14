import { useState } from 'react'
import { Download, ScrollText } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import {
  useActivityLogs,
  useExportActivityLogs,
} from '@/hooks/use-admin-activity-logs'

const PAGE_SIZE = 20

export function ActivityLogsPanel() {
  const [actorEmail, setActorEmail] = useState('')
  const [action, setAction] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, refetch } = useActivityLogs({
    actorEmail: actorEmail.trim() || undefined,
    action: action.trim() || undefined,
    limit: PAGE_SIZE,
    offset,
  })
  const exportLogs = useExportActivityLogs()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity log</CardTitle>
        <CardDescription>
          Audit trail of every admin action across user, dataset, knowledge
          base, and settings management.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exportLogs.isPending}
            onClick={() =>
              exportLogs.mutate({
                actorEmail: actorEmail.trim() || undefined,
                action: action.trim() || undefined,
              })
            }
          >
            <Download />
            Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Filter by actor email..."
            value={actorEmail}
            onChange={(event) => {
              setActorEmail(event.target.value)
              setOffset(0)
            }}
            className="sm:flex-1"
          />
          <Input
            placeholder="Filter by action..."
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setOffset(0)
            }}
            className="sm:flex-1"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load activity log"
            description="We couldn't reach the activity log endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No matching activity"
            description="Try a different actor email or action filter."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      {entry.actorEmail}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.targetType ? `${entry.targetType}: ${entry.targetId}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {data.total} total entries
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= data.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
