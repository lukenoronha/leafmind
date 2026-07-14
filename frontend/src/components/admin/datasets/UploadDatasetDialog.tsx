import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FileDropzone } from '@/components/admin/FileDropzone'
import { useUploadDataset } from '@/hooks/use-admin-datasets'

export function UploadDatasetDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadDataset()

  function reset() {
    setName('')
    setFile(null)
    upload.reset()
  }

  function handleSubmit() {
    if (!file || !name.trim()) return
    upload.mutate(
      { file, name: name.trim() },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus />
          Upload dataset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload dataset</DialogTitle>
          <DialogDescription>
            Add a new labeled image dataset for model training.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dataset-name">Dataset name</Label>
            <Input
              id="dataset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Medicinal Leaves v4"
            />
          </div>

          <FileDropzone
            accept=".zip"
            hint="ZIP archive of labeled images"
            isUploading={upload.isPending}
            progress={upload.progress}
            onFileSelected={setFile}
          />
          {file ? (
            <p className="text-muted-foreground text-sm">
              Selected: <span className="text-foreground">{file.name}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={upload.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!file || !name.trim() || upload.isPending}
          >
            {upload.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
