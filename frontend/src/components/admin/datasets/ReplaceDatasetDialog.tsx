import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/admin/FileDropzone'
import { useReplaceDataset } from '@/hooks/use-admin-datasets'
import type { Dataset } from '@/types/admin'

interface ReplaceDatasetDialogProps {
  dataset: Dataset | null
  onOpenChange: (open: boolean) => void
}

export function ReplaceDatasetDialog({
  dataset,
  onOpenChange,
}: ReplaceDatasetDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const replace = useReplaceDataset()

  function handleSubmit() {
    if (!dataset || !file) return
    replace.mutate(
      { datasetId: dataset.id, file },
      {
        onSuccess: () => {
          onOpenChange(false)
          setFile(null)
        },
      },
    )
  }

  return (
    <Dialog
      open={!!dataset}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setFile(null)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace &ldquo;{dataset?.name}&rdquo;</DialogTitle>
          <DialogDescription>
            Upload a new archive to replace this dataset&apos;s contents. The
            existing version will be superseded.
          </DialogDescription>
        </DialogHeader>

        <FileDropzone
          accept=".zip"
          hint="ZIP archive of labeled images"
          isUploading={replace.isPending}
          progress={replace.progress}
          onFileSelected={setFile}
        />
        {file ? (
          <p className="text-muted-foreground text-sm">
            Selected: <span className="text-foreground">{file.name}</span>
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={replace.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!file || replace.isPending}
          >
            {replace.isPending ? 'Replacing...' : 'Replace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
