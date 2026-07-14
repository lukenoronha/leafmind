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
import { FileDropzone } from '@/components/admin/FileDropzone'
import { useUploadKnowledgeDocument } from '@/hooks/use-admin-knowledge-base'

export function UploadDocumentDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadKnowledgeDocument()

  function handleSubmit() {
    if (!file) return
    upload.mutate(file, {
      onSuccess: () => {
        setOpen(false)
        setFile(null)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setFile(null)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus />
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload knowledge document</DialogTitle>
          <DialogDescription>
            Add a PDF to the RAG knowledge base. It will be queued for indexing
            after upload.
          </DialogDescription>
        </DialogHeader>

        <FileDropzone
          accept="application/pdf"
          hint="PDF document"
          isUploading={upload.isPending}
          progress={upload.progress}
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
            onClick={() => setOpen(false)}
            disabled={upload.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!file || upload.isPending}
          >
            {upload.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
