'use client'

import useSWR from 'swr'
import type {
  CallLogEnriched,
  CallMetrics,
  HourlyCallData,
  DailyCallData,
  DurationBucket,
  HeatmapCell,
  ActiveCallEnriched,
  ApiResponse,
  BusinessMetrics,
  CostSummary,
  Lead,
} from '@/lib/types'

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

interface CallsData {
  calls: CallLogEnriched[]
  metrics: CallMetrics
  hourlyData: HourlyCallData[]
  dailyData: DailyCallData[]
  durationBuckets: DurationBucket[]
  heatmapData: HeatmapCell[]
  businessMetrics: BusinessMetrics | null
  costSummary: CostSummary
  agentNames: Record<string, string>
}

export function useCalls() {
  const { data, error, isLoading, mutate } = useSWR<CallsData>(
    '/api/retell/calls',
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  )

  return {
    calls: data?.calls ?? [],
    metrics: data?.metrics ?? null,
    hourlyData: data?.hourlyData ?? [],
    dailyData: data?.dailyData ?? [],
    durationBuckets: data?.durationBuckets ?? [],
    heatmapData: data?.heatmapData ?? [],
    businessMetrics: data?.businessMetrics ?? null,
    costSummary: data?.costSummary ?? null,
    agentNames: data?.agentNames ?? {},
    isLoading,
    isError: error,
    refresh: mutate,
  }
}

export function useActiveCalls() {
  const { data, error, isLoading, mutate } = useSWR<ActiveCallEnriched[]>(
    '/api/retell/active-calls',
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  )

  return {
    activeCalls: data ?? [],
    isLoading,
    isError: error,
    refresh: mutate,
  }
}

export function useCallDetail(callId: string | null) {
  const { data, error, isLoading } = useSWR<
    (CallLogEnriched & { fullLead?: Lead | null }) | null
  >(callId ? `/api/retell/call/${callId}` : null, fetcher)

  return {
    call: data ?? null,
    isLoading,
    isError: error,
  }
}

export function useHealthStatus() {
  const { data, error, isLoading } = useSWR<
    ApiResponse<{ status: string; apiKeyConfigured: boolean }>
  >(
    '/api/retell/health',
    async (url: string) => {
      const res = await fetch(url)
      return res.json()
    },
    {
      refreshInterval: 60000,
    }
  )

  return {
    health: data?.data ?? null,
    isLoading,
    isError: error,
  }
}
