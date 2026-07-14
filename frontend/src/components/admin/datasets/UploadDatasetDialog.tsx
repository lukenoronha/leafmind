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
import { Switch } from '@/components/ui/switch'
import { FileDropzone } from '@/components/admin/FileDropzone'
import { useUploadDatasetClass } from '@/hooks/use-admin-datasets'

/**
 * Uploads (or replaces) one dataset class — the backend's real unit of
 * dataset management is a labeled folder of leaf images, not a versioned
 * ZIP-archive dataset. `replaceExisting` maps directly to the backend's
 * `replace_existing` flag on the same upload endpoint, so there is no
 * separate "replace" flow.
 */
export function UploadDatasetDialog() {
  const [open, setOpen] = useState(false)
  const [trainingLabel, setTrainingLabel] = useState('')
  const [folderName, setFolderName] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const upload = useUploadDatasetClass()

  function reset() {
    setTrainingLabel('')
    setFolderName('')
    setReplaceExisting(false)
    setFiles([])
    upload.reset()
  }

  function handleSubmit() {
    if (files.length === 0 || !trainingLabel.trim() || !folderName.trim()) return
    upload.mutate(
      {
        trainingLabel: trainingLabel.trim(),
        folderName: folderName.trim(),
        files,
        replaceExisting,
      },
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
          Upload class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload dataset class</DialogTitle>
          <DialogDescription>
            Add (or replace) a labeled species folder in the identification
            model's training data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="training-label">Species (training label)</Label>
            <Input
              id="training-label"
              value={trainingLabel}
              onChange={(event) => setTrainingLabel(event.target.value)}
              placeholder="e.g. Azadirachta_indica"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="e.g. Azadirachta_indica"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="replace-existing" className="text-foreground">
              Replace existing images for this class
            </Label>
            <Switch
              id="replace-existing"
              checked={replaceExisting}
              onCheckedChange={setReplaceExisting}
            />
          </div>

          <FileDropzone
            accept="image/jpeg,image/png"
            hint="One or more leaf images (JPEG/PNG)"
            multiple
            isUploading={upload.isPending}
            progress={upload.progress}
            onFileSelected={(file) => setFiles([file])}
            onFilesSelected={setFiles}
          />
          {files.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              Selected: <span className="text-foreground">{files.length} file(s)</span>
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
            disabled={
              files.length === 0 ||
              !trainingLabel.trim() ||
              !folderName.trim() ||
              upload.isPending
            }
          >
            {upload.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
