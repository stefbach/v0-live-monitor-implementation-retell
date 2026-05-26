'use client'

import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CallLogEnriched } from '@/lib/types'
import type { InsightsCallInput, InsightsRequest, InsightsResult } from '@/lib/insights/types'
import { useInsightsStore, makeInsightsKey } from '@/lib/stores/insights-store'

const fetcher = async (url: string, body: InsightsRequest) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json: { data?: InsightsResult; error?: string } | null = null
  try {
    json = await res.json()
  } catch {
    if (res.status === 504) {
      throw new Error(
        'La génération a pris trop de temps (timeout Vercel). Essaie avec une période plus courte.'
      )
    }
    throw new Error(`Erreur serveur inattendue (${res.status})`)
  }
  if (!res.ok) {
    throw new Error(json?.error || `API error: ${res.status}`)
  }
  return json!.data as InsightsResult
}

function toLLMInput(calls: CallLogEnriched[]): InsightsCallInput[] {
  return calls.map((c) => ({
    call_id: c.callId,
    summary: c.summary ?? null,
    qualification: c.lead?.qualification ?? null,
    sentiment: c.sentiment ?? null,
    duration_seconds: c.duration,
    hour_of_day: c.hourOfDay,
    day_of_week: c.dayOfWeek,
    disconnection_reason: c.disconnectionReason,
    attempt_number: c.attemptNumber,
    answered: c.answered,
  }))
}

interface Options {
  filteredCalls: CallLogEnriched[]
  periodLabel: string
  enabled: boolean
}

export function useInsights({ filteredCalls, periodLabel, enabled }: Options) {
  const llmInput = useMemo(() => toLLMInput(filteredCalls), [filteredCalls])
  const callIds = useMemo(() => llmInput.map((c) => c.call_id), [llmInput])
  const cacheKey = useMemo(
    () => makeInsightsKey(periodLabel, callIds),
    [periodLabel, callIds]
  )

  // Persistent local cache — survives tab switches and browser restarts
  const cached = useInsightsStore((s) => s.cache[cacheKey])
  const setCached = useInsightsStore((s) => s.setEntry)

  // SWR only fires when user explicitly enables AND we don't already have a cached entry
  const shouldFetch = enabled && !cached && llmInput.length > 0
  const swrKey = shouldFetch ? ['insights', cacheKey] : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<InsightsResult>(
    swrKey,
    () =>
      fetcher('/api/insights', {
        calls: llmInput,
        period_label: periodLabel,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      dedupingInterval: 60_000,
    }
  )

  // Persist newly-generated insights into the local store
  useEffect(() => {
    if (data) setCached(cacheKey, data)
  }, [data, cacheKey, setCached])

  // Local state for the manual refresh path — SWR doesn't see this fetch
  // so isLoading would stay false and errors would be swallowed otherwise.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<Error | undefined>(undefined)

  // Force a fresh server-side generation (ignores both client and server caches)
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setRefreshError(undefined)
    try {
      const result = await fetcher('/api/insights', {
        calls: llmInput,
        period_label: periodLabel,
        force_refresh: true,
      })
      setCached(cacheKey, result)
      await mutate(result, { revalidate: false })
      return result
    } catch (e) {
      setRefreshError(e as Error)
      throw e
    } finally {
      setIsRefreshing(false)
    }
  }, [mutate, llmInput, periodLabel, cacheKey, setCached])

  return {
    insights: cached ?? data ?? null,
    isLoading: isLoading || isValidating || isRefreshing,
    isError: (error || refreshError) as Error | undefined,
    refresh,
    hasInput: llmInput.length > 0,
    inputCount: llmInput.length,
    fromLocalCache: !!cached,
  }
}
