import { NextResponse } from 'next/server'
import type {
  CallLogEnriched,
  CallMetrics,
  HourlyCallData,
  DailyCallData,
  DurationBucket,
  HeatmapCell,
  ApiResponse,
  BusinessMetrics,
  CostSummary,
  CostPoint,
} from '@/lib/types'
import {
  getMockCallLogs,
  calculateMetrics,
  generateHourlyData,
  generateDailyData,
  generateDurationBuckets,
  generateHeatmapData,
  getMockActiveCalls,
} from '@/lib/mock-data'
import { getAgentNameMap } from '@/lib/agents'
import {
  fetchAllLeads,
  indexLeadsByPhone,
  toLeadSummary,
  computeBusinessMetrics,
} from '@/lib/leads'
import { normalizePhone, pickCounterpartyNumber } from '@/lib/phone'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface CallsResponse {
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

const EMPTY_RESPONSE: CallsResponse = {
  calls: [],
  metrics: {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    noAnswerCalls: 0,
    busyCalls: 0,
    successRate: 0,
    averageDuration: 0,
    totalDuration: 0,
    activeCalls: 0,
  },
  hourlyData: [],
  dailyData: [],
  durationBuckets: [],
  heatmapData: [],
  businessMetrics: null,
  costSummary: emptyCostSummary(),
  agentNames: {},
}

function emptyCostSummary(): CostSummary {
  return {
    totalCost: 0,
    avgCostPerCall: 0,
    costPerRdv: 0,
    todayCost: 0,
    weekCost: 0,
    monthCost: 0,
    daily: [],
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<CallsResponse>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const mockCalls = getMockCallLogs()
    const activeCalls = getMockActiveCalls()
    const metrics = calculateMetrics(mockCalls)
    metrics.activeCalls = activeCalls.length
    const enriched: CallLogEnriched[] = mockCalls.map((c) => ({
      ...c,
      cost: null,
      lead: null,
    }))
    return NextResponse.json({
      data: {
        calls: enriched,
        metrics,
        hourlyData: generateHourlyData(mockCalls),
        dailyData: generateDailyData(mockCalls),
        durationBuckets: generateDurationBuckets(mockCalls),
        heatmapData: generateHeatmapData(mockCalls),
        businessMetrics: null,
        costSummary: emptyCostSummary(),
        agentNames: {},
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Fetch Retell calls + leads + agent map in parallel
    const [retellResponse, leads, agentNames] = await Promise.all([
      fetch('https://api.retellai.com/v2/list-calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 1000, sort_order: 'descending' }),
      }),
      supabaseConfigured() ? fetchAllLeads() : Promise.resolve([]),
      getAgentNameMap(),
    ])

    if (!retellResponse.ok) {
      const errorBody = await retellResponse.text().catch(() => '')
      throw new Error(`Retell API error: ${retellResponse.status} ${errorBody}`)
    }

    const data = await retellResponse.json()
    const callsRaw: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { calls?: unknown[] })?.calls)
        ? ((data as { calls: Record<string, unknown>[] }).calls)
        : []

    const leadByPhone = indexLeadsByPhone(leads)
    const callsByAgent = new Map<
      string,
      { calls: number; duration: number; cost: number }
    >()

    const calls: CallLogEnriched[] = callsRaw.map((call) => {
      const startTs = call.start_timestamp as number | string | undefined
      const endTs = call.end_timestamp as number | string | undefined
      const startMs = startTs != null ? new Date(startTs).getTime() : NaN
      const endMs = endTs != null ? new Date(endTs).getTime() : NaN
      const direction =
        call.direction === 'inbound' ? ('inbound' as const) : ('outbound' as const)
      const fromNumber = (call.from_number as string) || ''
      const toNumber = (call.to_number as string) || ''
      const agentId = (call.agent_id as string) || ''
      const status = mapRetellStatus(call.call_status as string)
      const duration =
        Number.isFinite(endMs) && Number.isFinite(startMs)
          ? Math.floor((endMs - startMs) / 1000)
          : 0
      const counterparty = pickCounterpartyNumber(direction, fromNumber, toNumber)
      const lead = leadByPhone.get(normalizePhone(counterparty)) ?? null
      const costObj = call.call_cost as { combined_cost?: number } | undefined
      const cost =
        typeof costObj?.combined_cost === 'number' ? costObj.combined_cost : null
      const transcriptObj = call.transcript_object as unknown[] | undefined
      const recordingUrl = (call.recording_url as string) || undefined
      const summary =
        (call.call_summary as string) ||
        ((call.call_analysis as { call_summary?: string })?.call_summary as string) ||
        undefined

      // Per-agent aggregation
      if (agentId) {
        const bucket = callsByAgent.get(agentId) ?? { calls: 0, duration: 0, cost: 0 }
        bucket.calls++
        bucket.duration += duration
        bucket.cost += cost ?? 0
        callsByAgent.set(agentId, bucket)
      }

      return {
        id: (call.call_id as string) || '',
        callId: (call.call_id as string) || '',
        agentId,
        agentName: agentNames[agentId] || (call.agent_name as string) || 'Unknown Agent',
        status,
        direction,
        duration,
        startTime: Number.isFinite(startMs) ? new Date(startMs).toISOString() : '',
        endTime: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
        fromNumber,
        toNumber,
        userName: lead?.nom ?? undefined,
        recordingUrl,
        summary,
        cost,
        lead: lead ? toLeadSummary(lead) : null,
        transcript: Array.isArray(transcriptObj)
          ? transcriptObj.map((t, i) => mapTranscript(t, i))
          : undefined,
      }
    })

    const metrics = calculateMetrics(calls)
    const businessMetrics = leads.length
      ? computeBusinessMetrics(leads, agentNames, callsByAgent)
      : null
    const costSummary = computeCostSummary(calls)

    return NextResponse.json({
      data: {
        calls,
        metrics,
        hourlyData: generateHourlyData(calls),
        dailyData: generateDailyData(calls),
        durationBuckets: generateDurationBuckets(calls),
        heatmapData: generateHeatmapData(calls),
        businessMetrics,
        costSummary,
        agentNames,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: EMPTY_RESPONSE,
        error: error instanceof Error ? error.message : 'Failed to fetch calls',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

function mapRetellStatus(
  status: string
): 'active' | 'completed' | 'failed' | 'no-answer' | 'busy' {
  switch (status) {
    case 'ongoing':
      return 'active'
    case 'ended':
      return 'completed'
    case 'error':
      return 'failed'
    default:
      return 'completed'
  }
}

function mapTranscript(t: unknown, i: number) {
  const obj = (t as Record<string, unknown>) ?? {}
  const role = (obj.role as string) === 'user' ? 'user' : 'agent'
  return {
    id: `${i}`,
    speaker: role as 'agent' | 'user',
    text: (obj.content as string) || '',
    startTime: typeof obj.start === 'number' ? obj.start : 0,
    endTime: typeof obj.end === 'number' ? obj.end : 0,
  }
}

function computeCostSummary(calls: CallLogEnriched[]): CostSummary {
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  let totalCost = 0
  let todayCost = 0
  let weekCost = 0
  let monthCost = 0
  let rdvBookedFromCalls = 0

  const dailyMap = new Map<string, { cost: number; calls: number }>()

  for (const c of calls) {
    const cost = c.cost ?? 0
    totalCost += cost
    const t = c.startTime ? new Date(c.startTime).getTime() : NaN
    if (Number.isFinite(t)) {
      if (t >= startOfToday) todayCost += cost
      if (t >= startOfWeek) weekCost += cost
      if (t >= startOfMonth) monthCost += cost
      const dayKey = new Date(t).toISOString().split('T')[0]
      const bucket = dailyMap.get(dayKey) ?? { cost: 0, calls: 0 }
      bucket.cost += cost
      bucket.calls += 1
      dailyMap.set(dayKey, bucket)
    }
    if (c.lead?.qualification === 'RDV MEDECIN') rdvBookedFromCalls++
  }

  const daily: CostPoint[] = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, cost: v.cost, calls: v.calls }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  return {
    totalCost,
    avgCostPerCall: calls.length > 0 ? totalCost / calls.length : 0,
    costPerRdv: rdvBookedFromCalls > 0 ? totalCost / rdvBookedFromCalls : 0,
    todayCost,
    weekCost,
    monthCost,
    daily,
  }
}
