import {
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Layers,
  MemoryStick,
  Server,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { useAdminSystemStatus } from '@/hooks/use-admin-system-status'
import type { SystemComponentStatus } from '@/types/developer'
import { cn } from '@/lib/utils'

const ICON_BY_ID: Record<string, LucideIcon> = {
  backend: Server,
  database: Database,
  chromadb: Layers,
  model: Cpu,
  'api-uptime': Gauge,
  memory: MemoryStick,
  disk: HardDrive,
}

const STATUS_LABEL: Record<SystemComponentStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
}

const STATUS_DOT: Record<SystemComponentStatus, string> = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-destructive',
}

const STATUS_BADGE_VARIANT: Record<
  SystemComponentStatus,
  'default' | 'secondary' | 'destructive'
> = {
  operational: 'default',
  degraded: 'secondary',
  down: 'destructive',
}

export function AdminSystemStatusGrid() {
  const { data, isLoading, isError, refetch } = useAdminSystemStatus()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load system status"
        description="We couldn't reach the system status endpoint."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data?.map((component) => {
        const Icon = ICON_BY_ID[component.id] ?? Server
        return (
          <Card key={component.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="text-muted-foreground size-4" />
                  <p className="text-foreground text-sm font-medium">
                    {component.name}
                  </p>
                </div>
                <span
                  className={cn(
                    'size-2 rounded-full',
                    STATUS_DOT[component.status],
                  )}
                  aria-hidden
                />
              </div>
              <Badge variant={STATUS_BADGE_VARIANT[component.status]}>
                {STATUS_LABEL[component.status]}
              </Badge>
              <p className="text-muted-foreground text-xs">
                {component.detail}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
