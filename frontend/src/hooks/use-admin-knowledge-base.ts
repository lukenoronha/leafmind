import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'

const DOCUMENTS_QUERY_KEY = ['admin', 'knowledge', 'documents'] as const

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: () => adminService.getKnowledgeDocuments(),
  })
}

export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: (file: File) => {
      setProgress(0)
      return adminService.uploadKnowledgeDocument(file, {
        onProgress: setProgress,
      })
    },
    onSuccess: () => {
      toast.success('Document uploaded and queued for indexing.')
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to upload document.'))
    },
  })

  return { ...mutation, progress }
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      adminService.deleteKnowledgeDocument(documentId),
    onSuccess: () => {
      toast.success('Document deleted.')
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to delete document.'))
    },
  })
}

export function useReindexKnowledgeDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      adminService.reindexKnowledgeDocument(documentId),
    onSuccess: () => {
      toast.success('Re-indexing started.')
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to start re-indexing.'))
    },
  })
}
