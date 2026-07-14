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
import type { AdminSystemStatus } from '@/types/admin'
import { cn } from '@/lib/utils'

interface ComponentDef {
  id: string
  name: string
  icon: LucideIcon
  healthy: (status: AdminSystemStatus) => boolean
  detail: (status: AdminSystemStatus) => string
}

const COMPONENTS: ComponentDef[] = [
  {
    id: 'backend',
    name: 'Backend',
    icon: Server,
    healthy: (s) => s.backendHealthy,
    detail: (s) => `Uptime ${Math.round(s.uptimeSeconds / 60)}m`,
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    healthy: (s) => s.databaseHealthy,
    detail: (s) => (s.databaseHealthy ? 'Connected' : 'Unreachable'),
  },
  {
    id: 'chromadb',
    name: 'ChromaDB',
    icon: Layers,
    healthy: (s) => s.chromadbHealthy,
    detail: (s) => (s.chromadbHealthy ? 'Connected' : 'Unreachable'),
  },
  {
    id: 'model',
    name: 'Models',
    icon: Cpu,
    healthy: (s) => s.vlmModelLoaded && s.embeddingModelLoaded,
    detail: (s) =>
      `VLM ${s.vlmModelLoaded ? 'loaded' : 'not loaded'}, embeddings ${
        s.embeddingModelLoaded ? 'loaded' : 'not loaded'
      }`,
  },
  {
    id: 'api-latency',
    name: 'API latency',
    icon: Gauge,
    healthy: (s) => s.avgRequestLatencyMs < 1000,
    detail: (s) =>
      `avg ${Math.round(s.avgRequestLatencyMs)}ms / p95 ${Math.round(s.p95RequestLatencyMs)}ms`,
  },
  {
    id: 'memory',
    name: 'Memory',
    icon: MemoryStick,
    healthy: (s) => s.memoryPercent < 90,
    detail: (s) => `${Math.round(s.memoryPercent)}% used`,
  },
  {
    id: 'disk',
    name: 'Disk',
    icon: HardDrive,
    healthy: (s) => s.diskPercent < 90,
    detail: (s) => `${Math.round(s.diskPercent)}% used`,
  },
]

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

  if (isError || !data) {
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
      {COMPONENTS.map((component) => {
        const healthy = component.healthy(data)
        return (
          <Card key={component.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <component.icon className="text-muted-foreground size-4" />
                  <p className="text-foreground text-sm font-medium">
                    {component.name}
                  </p>
                </div>
                <span
                  className={cn(
                    'size-2 rounded-full',
                    healthy ? 'bg-success' : 'bg-destructive',
                  )}
                  aria-hidden
                />
              </div>
              <Badge variant={healthy ? 'default' : 'destructive'}>
                {healthy ? 'Operational' : 'Degraded'}
              </Badge>
              <p className="text-muted-foreground text-xs">
                {component.detail(data)}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
