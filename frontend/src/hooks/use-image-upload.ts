import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { analysisService } from '@/services/analysis.service'

export function useImageUpload() {
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: (file: File) => {
      setProgress(0)
      return analysisService.uploadImage(file, {
        onProgress: setProgress,
      })
    },
  })

  return {
    upload: mutation.mutateAsync,
    isUploading: mutation.isPending,
    progress,
    error: mutation.error,
    reset: () => {
      mutation.reset()
      setProgress(0)
    },
  }
}
