import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { adminService } from '@/services/admin.service'
import { getApiErrorMessage } from '@/lib/api-error'

const DATASETS_QUERY_KEY = ['admin', 'datasets'] as const
const DATASET_STATS_QUERY_KEY = ['admin', 'datasets', 'statistics'] as const

export function useAdminDatasetStatistics() {
  return useQuery({
    queryKey: DATASET_STATS_QUERY_KEY,
    queryFn: () => adminService.getDatasetStatistics(),
  })
}

export function useAdminDatasetClasses() {
  return useQuery({
    queryKey: DATASETS_QUERY_KEY,
    queryFn: () => adminService.getDatasetClasses(),
  })
}

export function useUploadDatasetClass() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: ({
      trainingLabel,
      folderName,
      files,
      replaceExisting,
    }: {
      trainingLabel: string
      folderName: string
      files: File[]
      replaceExisting: boolean
    }) => {
      setProgress(0)
      return adminService.uploadDatasetClass(
        trainingLabel,
        folderName,
        files,
        replaceExisting,
        { onProgress: setProgress },
      )
    },
    onSuccess: () => {
      toast.success('Dataset class uploaded.')
      void queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: DATASET_STATS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to upload dataset class.'))
    },
  })

  return { ...mutation, progress }
}

export function useDeleteDatasetClass() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (classId: number) => adminService.deleteDatasetClass(classId),
    onSuccess: () => {
      toast.success('Dataset class deleted.')
      void queryClient.invalidateQueries({ queryKey: DATASETS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: DATASET_STATS_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to delete dataset class.'))
    },
  })
}
