import { useState } from 'react'
import { Boxes, Database, Layers, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import {
  useEmbeddingStats,
  useRebuildEmbeddings,
} from '@/hooks/use-admin-embeddings'

interface StatDef {
  label: string
  value: string
  icon: LucideIcon
}

export function EmbeddingManagementPanel() {
  const { data, isLoading, isError, refetch } = useEmbeddingStats()
  const rebuild = useRebuildEmbeddings()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const stats: StatDef[] | null = data
    ? [
        { label: 'Collection', value: data.collectionName, icon: Boxes },
        {
          label: 'Vector count',
          value: data.vectorCount.toLocaleString(),
          icon: Database,
        },
        { label: 'Distance metric', value: data.distanceMetric, icon: Layers },
      ]
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embedding management</CardTitle>
        <CardDescription>
          Vector collection powering retrieval-augmented generation.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={rebuild.isPending}
          >
            <RefreshCw className={rebuild.isPending ? 'animate-spin' : ''} />
            Rebuild
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load embedding stats"
            description="We couldn't reach the embeddings endpoint."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3"
              >
                <stat.icon className="text-primary size-4" />
                <p className="text-foreground truncate text-lg font-semibold">
                  {stat.value}
                </p>
                <p className="text-muted-foreground text-xs">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rebuild the vector index?"
        description="This re-embeds every document in the knowledge base. It may take several minutes and retrieval quality may be temporarily degraded while it runs."
        confirmLabel="Rebuild"
        confirmPendingLabel="Rebuilding..."
        confirmVariant="default"
        isPending={rebuild.isPending}
        onConfirm={() =>
          rebuild.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })
        }
      />
    </Card>
  )
}
