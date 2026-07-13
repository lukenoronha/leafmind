import { useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useDeveloperLogs } from '@/hooks/use-developer-dashboard'
import type { LogLevel } from '@/types/developer'
import { cn } from '@/lib/utils'

const LEVEL_OPTIONS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
]

const LEVEL_BADGE_VARIANT: Record<
  LogLevel,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  debug: 'outline',
  info: 'secondary',
  warning: 'default',
  error: 'destructive',
}

export function LogsViewer() {
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch } = useDeveloperLogs({
    level: level === 'all' ? undefined : level,
  })

  const filteredLogs = useMemo(() => {
    if (!data) return data
    const query = search.trim().toLowerCase()
    if (!query) return data
    return data.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.source.toLowerCase().includes(query),
    )
  }, [data, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
        <CardDescription>
          Backend and pipeline logs, filterable by level and source.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={level}
            onValueChange={(value) => setLevel(value as LogLevel | 'all')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search message or source..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:flex-1"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load logs"
            description="We couldn't reach the logs endpoint."
            onRetry={() => void refetch()}
          />
        ) : !filteredLogs || filteredLogs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No matching logs"
            description="Try a different level or search term."
          />
        ) : (
          <div className="bg-muted/20 max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2 font-mono text-xs">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'flex flex-wrap items-start gap-2 rounded-md px-2 py-1.5',
                  log.level === 'error' && 'bg-destructive/5',
                )}
              >
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <Badge
                  variant={LEVEL_BADGE_VARIANT[log.level]}
                  className="shrink-0 uppercase"
                >
                  {log.level}
                </Badge>
                <span className="text-muted-foreground shrink-0 font-medium">
                  {log.source}
                </span>
                <span className="text-foreground min-w-0 flex-1 break-words">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
