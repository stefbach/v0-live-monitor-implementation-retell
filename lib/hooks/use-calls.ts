'use client'

import useSWR from 'swr'
import type { CallLog, CallMetrics, HourlyCallData, DailyCallData, DurationBucket, HeatmapCell, ActiveCall, ApiResponse } from '@/lib/types'

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

interface CallsData {
  calls: CallLog[]
  metrics: CallMetrics
  hourlyData: HourlyCallData[]
  dailyData: DailyCallData[]
  durationBuckets: DurationBucket[]
  heatmapData: HeatmapCell[]
}

export function useCalls() {
  const { data, error, isLoading, mutate } = useSWR<CallsData>(
    '/api/retell/calls',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
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
    isLoading,
    isError: error,
    refresh: mutate,
  }
}

export function useActiveCalls() {
  const { data, error, isLoading, mutate } = useSWR<ActiveCall[]>(
    '/api/retell/active-calls',
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5 seconds for live data
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
  const { data, error, isLoading } = useSWR<CallLog | null>(
    callId ? `/api/retell/call/${callId}` : null,
    fetcher
  )

  return {
    call: data ?? null,
    isLoading,
    isError: error,
  }
}

export function useHealthStatus() {
  const { data, error, isLoading } = useSWR<ApiResponse<{ status: string; apiKeyConfigured: boolean }>>(
    '/api/retell/health',
    async (url: string) => {
      const res = await fetch(url)
      return res.json()
    },
    {
      refreshInterval: 60000, // Check every minute
    }
  )

  return {
    health: data?.data ?? null,
    isLoading,
    isError: error,
  }
}
