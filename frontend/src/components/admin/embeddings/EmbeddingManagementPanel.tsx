import { useState } from 'react'
import { Boxes, Database, HardDrive, Layers, RefreshCw } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useEmbeddingStats,
  useRebuildEmbeddings,
} from '@/hooks/use-admin-embeddings'
import { formatBytes } from '@/lib/utils'

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
        { label: 'Embedding model', value: data.embeddingModel, icon: Layers },
        {
          label: 'Vector count',
          value: data.vectorCount.toLocaleString(),
          icon: Database,
        },
        { label: 'Dimensions', value: String(data.dimensions), icon: Layers },
        {
          label: 'Storage used',
          value: formatBytes(data.storageUsedBytes),
          icon: HardDrive,
        },
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
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
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            {data ? (
              <p className="text-muted-foreground text-xs">
                Last rebuilt {new Date(data.lastRebuiltAt).toLocaleString()}
              </p>
            ) : null}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebuild the vector index?</AlertDialogTitle>
            <AlertDialogDescription>
              This re-embeds every document in the knowledge base. It may take
              several minutes and retrieval quality may be temporarily degraded
              while it runs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                rebuild.mutate(undefined, {
                  onSuccess: () => setConfirmOpen(false),
                })
              }}
              disabled={rebuild.isPending}
            >
              {rebuild.isPending ? 'Rebuilding...' : 'Rebuild'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
