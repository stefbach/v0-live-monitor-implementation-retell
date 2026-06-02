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

  // Compute the fetch lookback from the selected period so the server only
  // pulls what we actually need to display. We deliberately fetch a SUPERSET
  // (e.g. last 30d) instead of a tight window so client-side period switches
  // don't trigger a re-fetch each time — applyFilters() handles the narrowing.
  const fetchSinceMs = useMemo(() => {
    const { start } = periodRange(filters.period, filters.customStart, filters.customEnd)
    if (filters.period === 'today' || filters.period === 'yesterday' || filters.period === '7d') {
      // For short windows, request the last 30d so navigating periods is instant.
      return Date.now() - 30 * 24 * 60 * 60 * 1000
    }
    if (filters.period === '30d') return Date.now() - 30 * 24 * 60 * 60 * 1000
    if (filters.period === 'all') return 0 // 0 = no filter on server side
    return start // 'custom' → exact lower bound
  }, [filters.period, filters.customStart, filters.customEnd])

  const swrKey = `/api/retell/calls?since=${fetchSinceMs}`

  const { data, error, isLoading, mutate } = useSWR<RawCallsData>(
    swrKey,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
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
