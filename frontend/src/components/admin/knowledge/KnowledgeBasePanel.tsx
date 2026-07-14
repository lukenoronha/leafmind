import { useState } from 'react'
import { Eye, FileText, RefreshCcw, Trash2 } from 'lucide-react'
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
import { UploadDocumentDialog } from '@/components/admin/knowledge/UploadDocumentDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
  useReindexKnowledgeDocument,
} from '@/hooks/use-admin-knowledge-base'
import type { DocumentIndexStatus } from '@/types/admin'
import { formatBytes } from '@/lib/utils'

const STATUS_VARIANT: Record<
  DocumentIndexStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  indexed: 'default',
  indexing: 'secondary',
  queued: 'outline',
  failed: 'destructive',
}

export function KnowledgeBasePanel() {
  const { data, isLoading, isError, refetch } = useKnowledgeDocuments()
  const deleteDocument = useDeleteKnowledgeDocument()
  const reindexDocument = useReindexKnowledgeDocument()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function handleConfirmDelete() {
    if (!pendingDeleteId) return
    deleteDocument.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge base</CardTitle>
        <CardDescription>
          PDF documents indexed into the RAG vector store.
        </CardDescription>
        <CardAction>
          <UploadDocumentDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Unable to load documents"
            description="We couldn't reach the knowledge base endpoint."
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload a PDF to build the RAG knowledge base."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <p className="text-foreground font-medium">{doc.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {doc.fileName}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[doc.indexStatus]}
                      className="capitalize"
                    >
                      {doc.indexStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.pageCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.chunkCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(doc.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`Preview ${doc.title}`}
                      >
                        <a
                          href={doc.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="size-4" />
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={
                          reindexDocument.isPending ||
                          doc.indexStatus === 'indexing'
                        }
                        onClick={() => reindexDocument.mutate(doc.id)}
                        aria-label={`Re-index ${doc.title}`}
                      >
                        <RefreshCcw className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDeleteId(doc.id)}
                        aria-label={`Delete ${doc.title}`}
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

      <DeleteConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this document?"
        description="This removes the document and its vector embeddings from the knowledge base. This action cannot be undone."
        onConfirm={handleConfirmDelete}
        isPending={deleteDocument.isPending}
      />
    </Card>
  )
}
