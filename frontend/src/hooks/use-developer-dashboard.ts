import { useQuery } from '@tanstack/react-query'
import { developerService } from '@/services/developer.service'
import type { LogFilters } from '@/types/developer'

const REFRESH_INTERVAL_MS = 30_000

export function useKpis() {
  return useQuery({
    queryKey: ['developer', 'kpis'],
    queryFn: async () => {
      const { data } = await developerService.getKpis()
      return data
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ['developer', 'pipeline'],
    queryFn: async () => {
      const { data } = await developerService.getPipelineStages()
      return data
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function usePredictionAnalytics() {
  return useQuery({
    queryKey: ['developer', 'predictions', 'analytics'],
    queryFn: async () => {
      const { data } = await developerService.getPredictionAnalytics()
      return data
    },
  })
}

export function useRagAnalytics() {
  return useQuery({
    queryKey: ['developer', 'rag', 'analytics'],
    queryFn: async () => {
      const { data } = await developerService.getRagAnalytics()
      return data
    },
  })
}

export function usePromptInspectorEntries() {
  return useQuery({
    queryKey: ['developer', 'prompts'],
    queryFn: async () => {
      const { data } = await developerService.getPromptInspectorEntries()
      return data
    },
  })
}

export function useDeveloperLogs(filters: LogFilters) {
  return useQuery({
    queryKey: ['developer', 'logs', filters],
    queryFn: async () => {
      const { data } = await developerService.getLogs(filters)
      return data
    },
  })
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['developer', 'system', 'status'],
    queryFn: async () => {
      const { data } = await developerService.getSystemStatus()
      return data
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
