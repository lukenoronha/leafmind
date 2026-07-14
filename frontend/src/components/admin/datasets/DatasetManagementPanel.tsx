import { useState } from 'react'
import { Database, Trash2 } from 'lucide-react'
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
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import {
  useAdminDatasetClasses,
  useDeleteDatasetClass,
} from '@/hooks/use-admin-datasets'

export function DatasetManagementPanel() {
  const { data, isLoading, isError, refetch } = useAdminDatasetClasses()
  const deleteClass = useDeleteDatasetClass()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  function handleConfirmDelete() {
    if (pendingDeleteId === null) return
    deleteClass.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset management</CardTitle>
        <CardDescription>
          Labeled species classes powering the identification model.
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
            title="Unable to load dataset classes"
            description="We couldn't reach the dataset endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No dataset classes yet"
            description="Upload a labeled species folder to start training the identification model."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Species</TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((dataset) => (
                <TableRow key={dataset.classId}>
                  <TableCell>
                    <p className="text-foreground font-medium">
                      {dataset.displayName}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataset.folderName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={dataset.isVerified ? 'default' : 'secondary'}
                    >
                      {dataset.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDeleteId(dataset.classId)}
                      aria-label={`Delete ${dataset.displayName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this dataset class?"
        description="This permanently removes the class's images and taxonomy entry. Models trained on it will not be affected retroactively."
        onConfirm={handleConfirmDelete}
        isPending={deleteClass.isPending}
      />
    </Card>
  )
}
