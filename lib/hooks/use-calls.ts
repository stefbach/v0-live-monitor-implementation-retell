'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useMemo, useEffect } from 'react'
import type {
  CallLogEnriched,
  ActiveCallEnriched,
  ApiResponse,
  Lead,
  CallMetrics,
  BusinessMetrics,
  DashboardFilters,
} from '@/lib/types'
import { applyFilters, periodRange } from '@/lib/filters'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { computeBusinessMetrics } from '@/lib/leads'
import { computeConfirmedRdvLeads, effectiveQualKey } from '@/lib/rdv'

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  return json.data
}

interface RawCallsData {
  calls: CallLogEnriched[]
  leads: Lead[]
  agentNames: Record<string, string>
}

export interface DashboardData {
  allCalls: CallLogEnriched[]
  filteredCalls: CallLogEnriched[]
  leads: Lead[]
  agentNames: Record<string, string>
  callMetrics: CallMetrics
  businessMetrics: BusinessMetrics | null
  filters: DashboardFilters
  isLoading: boolean
  isError: unknown
  refresh: () => Promise<unknown>
}

function buildCallMetrics(
  calls: CallLogEnriched[],
  confirmedRdvLeadKeys: Set<string>
): CallMetrics {
  const total = calls.length
  const successful = calls.filter(
    (c) => effectiveQualKey(c, confirmedRdvLeadKeys) === 'rdv_confirme'
  ).length
  const failed = calls.filter((c) => c.status === 'failed').length
  const noAnswer = calls.filter((c) => !c.answered).length
  const busy = calls.filter((c) => c.status === 'busy').length
  const active = calls.filter((c) => c.status === 'active').length
  const totalDuration = calls.reduce((s, c) => s + c.duration, 0)
  return {
    totalCalls: total,
    successfulCalls: successful,
    failedCalls: failed,
    noAnswerCalls: noAnswer,
    busyCalls: busy,
    successRate: total > 0 ? (successful / total) * 100 : 0,
    averageDuration: total > 0 ? totalDuration / total : 0,
    totalDuration,
    activeCalls: active,
  }
}

export function useDashboardData(): DashboardData {
  const filters = useFiltersStore((s) => s.filters)
  const setConfirmedRdvLeadKeys = useRdvStore((s) => s.setConfirmedRdvLeadKeys)

  // Align the fetch lookback to the selected period so the server only pulls
  // what we need. With high-volume customers (5000+ calls/30d) fetching a
  // fixed 30-day window for "Today" inflates the payload ~30× and slows the
  // dashboard. Switching periods triggers a re-fetch — acceptable trade-off
  // for ~5× faster initial load on Today/Yesterday.
  //
  // Add a small buffer (1 day for short windows, 1 hour for 30d) to absorb
  // timezone edge cases and clock skew between the client and Retell.
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const fetchSinceMs = useMemo(() => {
    const { start } = periodRange(filters.period, filters.customStart, filters.customEnd)
    switch (filters.period) {
      case 'today':
      case 'yesterday':
        return start - ONE_DAY_MS // 2-day window covers both today + yesterday
      case '7d':
        return start - ONE_DAY_MS // 8 days
      case '30d':
        return start - 60 * 60 * 1000 // 30d + 1h
      case 'all':
        return 0 // unbounded — server applies its own ceiling
      case 'custom':
      default:
        return Math.max(0, start - ONE_DAY_MS)
    }
  }, [filters.period, filters.customStart, filters.customEnd, ONE_DAY_MS])

  const swrKey = `/api/retell/calls?since=${fetchSinceMs}`

  const { data, error, isLoading, mutate } = useSWR<RawCallsData>(
    swrKey,
    fetcher,
    {
      // Refresh in the background every 2 min. The Live tab has its own
      // 5s-poll endpoint, so users who need real-time monitoring use that;
      // 30s here was wasteful (full ~10 MB refetch + reparse) and caused
      // perceptible UI jank on slow networks.
      refreshInterval: 120000,
      revalidateOnFocus: true,
      // Coalesce duplicate calls (e.g. when several components mount
      // simultaneously) into a single network request.
      dedupingInterval: 30000,
    }
  )

  const allCalls = data?.calls ?? []
  const leads = data?.leads ?? []
  const agentNames = data?.agentNames ?? {}

  // Compute strict RDV lead keys once per dataset and push to the store
  // so all components can read it without prop-drilling.
  const confirmedRdvLeadKeys = useMemo(
    () => computeConfirmedRdvLeads(allCalls),
    [allCalls]
  )
  useEffect(() => {
    setConfirmedRdvLeadKeys(confirmedRdvLeadKeys)
  }, [confirmedRdvLeadKeys, setConfirmedRdvLeadKeys])

  const filteredCalls = useMemo(() => applyFilters(allCalls, filters), [allCalls, filters])
  const callMetrics = useMemo(
    () => buildCallMetrics(filteredCalls, confirmedRdvLeadKeys),
    [filteredCalls, confirmedRdvLeadKeys]
  )

  const businessMetrics = useMemo<BusinessMetrics | null>(() => {
    if (!leads.length) return null
    const callsByAgent = new Map<string, { calls: number; duration: number; cost: number }>()
    for (const c of filteredCalls) {
      if (!c.agentId) continue
      const bucket = callsByAgent.get(c.agentId) ?? { calls: 0, duration: 0, cost: 0 }
      bucket.calls++
      bucket.duration += c.duration
      bucket.cost += c.cost ?? 0
      callsByAgent.set(c.agentId, bucket)
    }
    return computeBusinessMetrics(leads, agentNames, callsByAgent)
  }, [leads, agentNames, filteredCalls])

  return {
    allCalls,
    filteredCalls,
    leads,
    agentNames,
    callMetrics,
    businessMetrics,
    filters,
    isLoading,
    isError: error,
    refresh: mutate,
  }
}

// Legacy hooks (kept for compatibility with other pieces)
export function useCalls() {
  return useDashboardData()
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
  const { mutate: globalMutate } = useSWRConfig()
  const { data, error, isLoading } = useSWR<
    (CallLogEnriched & { fullLead?: Lead | null }) | null
  >(callId ? `/api/retell/call/${callId}` : null, fetcher, {
    onSuccess: () => {
      globalMutate('/api/dashboard/errors')
    },
  })

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
    { refreshInterval: 60000 }
  )

  return {
    health: data?.data ?? null,
    isLoading,
    isError: error,
  }
}
