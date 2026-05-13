'use client'

import useSWR from 'swr'
import { useCallback, useMemo } from 'react'
import type { CallLogEnriched } from '@/lib/types'
import type { InsightsCallInput, InsightsRequest, InsightsResult } from '@/lib/insights/types'

const fetcher = async (url: string, body: InsightsRequest) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `API error: ${res.status}`)
  }
  return json.data as InsightsResult
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
  const callIds = useMemo(() => llmInput.map((c) => c.call_id).sort().join('|'), [llmInput])

  const swrKey = enabled && llmInput.length > 0 ? ['insights', periodLabel, callIds] : null

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
    }
  )

  const refresh = useCallback(
    async () =>
      mutate(
        async () =>
          fetcher('/api/insights', {
            calls: llmInput,
            period_label: periodLabel,
            force_refresh: true,
          }),
        { revalidate: false }
      ),
    [mutate, llmInput, periodLabel]
  )

  return {
    insights: data ?? null,
    isLoading: isLoading || isValidating,
    isError: error as Error | undefined,
    refresh,
    hasInput: llmInput.length > 0,
    inputCount: llmInput.length,
  }
}
