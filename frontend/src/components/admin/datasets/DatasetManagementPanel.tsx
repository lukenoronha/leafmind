import { useState } from 'react'
import { Database, RefreshCcw, Trash2 } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { UploadDatasetDialog } from '@/components/admin/datasets/UploadDatasetDialog'
import { ReplaceDatasetDialog } from '@/components/admin/datasets/ReplaceDatasetDialog'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { useAdminDatasets, useDeleteDataset } from '@/hooks/use-admin-datasets'
import type { Dataset, DatasetStatus } from '@/types/admin'
import { formatBytes } from '@/lib/utils'

const STATUS_VARIANT: Record<
  DatasetStatus,
  'default' | 'secondary' | 'destructive'
> = {
  ready: 'default',
  processing: 'secondary',
  error: 'destructive',
}

export function DatasetManagementPanel() {
  const { data, isLoading, isError, refetch } = useAdminDatasets()
  const deleteDataset = useDeleteDataset()
  const [replaceTarget, setReplaceTarget] = useState<Dataset | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function handleConfirmDelete() {
    if (!pendingDeleteId) return
    deleteDataset.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset management</CardTitle>
        <CardDescription>
          Training datasets powering the identification model.
        </CardDescription>
        <CardAction>
          <UploadDatasetDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load datasets"
            description="We couldn't reach the dataset endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No datasets yet"
            description="Upload a dataset to start training the identification model."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((dataset) => (
                <TableRow key={dataset.id}>
                  <TableCell>
                    <p className="text-foreground font-medium">
                      {dataset.name}
                    </p>
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {dataset.description}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[dataset.status]}
                      className="capitalize"
                    >
                      {dataset.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataset.imageCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataset.classCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(dataset.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataset.version}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(dataset.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setReplaceTarget(dataset)}
                        aria-label={`Replace ${dataset.name}`}
                      >
                        <RefreshCcw className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDeleteId(dataset.id)}
                        aria-label={`Delete ${dataset.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ReplaceDatasetDialog
        dataset={replaceTarget}
        onOpenChange={(open) => !open && setReplaceTarget(null)}
      />

      <DeleteConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this dataset?"
        description="This permanently removes the dataset. Models trained on it will not be affected retroactively."
        onConfirm={handleConfirmDelete}
        isPending={deleteDataset.isPending}
      />
    </Card>
  )
}
