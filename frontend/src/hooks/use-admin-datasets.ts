import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'

const DATASETS_QUERY_KEY = ['admin', 'datasets'] as const

export function useAdminDatasets() {
  return useQuery({
    queryKey: DATASETS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await adminService.getDatasets()
      return data
    },
  })
}

export function useUploadDataset() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => {
      setProgress(0)
      return adminService.uploadDataset(file, name, { onProgress: setProgress })
    },
    onSuccess: () => {
      toast.success('Dataset uploaded.')
      void queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to upload dataset.'))
    },
  })

  return { ...mutation, progress }
}

export function useReplaceDataset() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: ({ datasetId, file }: { datasetId: string; file: File }) => {
      setProgress(0)
      return adminService.replaceDataset(datasetId, file, {
        onProgress: setProgress,
      })
    },
    onSuccess: () => {
      toast.success('Dataset replaced.')
      void queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to replace dataset.'))
    },
  })

  return { ...mutation, progress }
}

export function useDeleteDataset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (datasetId: string) => adminService.deleteDataset(datasetId),
    onSuccess: () => {
      toast.success('Dataset deleted.')
      void queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to delete dataset.'))
    },
  })
}
