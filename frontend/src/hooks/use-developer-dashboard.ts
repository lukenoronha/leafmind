import { useQuery } from '@tanstack/react-query'
import { developerService } from '@/services/developer.service'
import type { LogFilters } from '@/types/developer'

const REFRESH_INTERVAL_MS = 30_000

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['developer', 'analytics'],
    queryFn: () => developerService.getAnalyticsSummary(),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function useAverageTimings() {
  return useQuery({
    queryKey: ['developer', 'timings'],
    queryFn: () => developerService.getAverageTimings(),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function usePredictionAnalytics() {
  return useQuery({
    queryKey: ['developer', 'predictions', 'analytics'],
    queryFn: () => developerService.getPredictionAnalytics(),
  })
}

export function usePromptInspectorEntry(chatMessageId: string | null) {
  return useQuery({
    queryKey: ['developer', 'prompt-inspector', chatMessageId],
    queryFn: () => developerService.getPromptInspectorEntry(chatMessageId!),
    enabled: !!chatMessageId,
    retry: false,
  })
}

export function useDeveloperLogs(filters: LogFilters) {
  return useQuery({
    queryKey: ['developer', 'logs', filters],
    queryFn: () => developerService.getLogs(filters),
  })
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['developer', 'system', 'status'],
    queryFn: () => developerService.getSystemStatus(),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
