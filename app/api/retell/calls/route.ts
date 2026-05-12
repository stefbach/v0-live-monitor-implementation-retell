import { NextResponse } from 'next/server'
import type { CallLog, CallMetrics, HourlyCallData, DailyCallData, DurationBucket, HeatmapCell, ApiResponse } from '@/lib/types'
import {
  getMockCallLogs,
  calculateMetrics,
  generateHourlyData,
  generateDailyData,
  generateDurationBuckets,
  generateHeatmapData,
  getMockActiveCalls,
} from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

interface CallsResponse {
  calls: CallLog[]
  metrics: CallMetrics
  hourlyData: HourlyCallData[]
  dailyData: DailyCallData[]
  durationBuckets: DurationBucket[]
  heatmapData: HeatmapCell[]
}

export async function GET(): Promise<NextResponse<ApiResponse<CallsResponse>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const calls = getMockCallLogs()
    const activeCalls = getMockActiveCalls()
    const metrics = calculateMetrics(calls)
    metrics.activeCalls = activeCalls.length

    return NextResponse.json({
      data: {
        calls,
        metrics,
        hourlyData: generateHourlyData(calls),
        dailyData: generateDailyData(calls),
        durationBuckets: generateDurationBuckets(calls),
        heatmapData: generateHeatmapData(calls),
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Fetch calls from Retell API (v2/list-calls is a POST endpoint)
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 1000, sort_order: 'descending' }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Retell API error: ${response.status} ${errorBody}`)
    }

    const data = await response.json()
    const callsRaw: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { calls?: unknown[] })?.calls)
        ? ((data as { calls: Record<string, unknown>[] }).calls)
        : []

    // Transform Retell API response to our CallLog type
    const calls: CallLog[] = callsRaw.map((call: Record<string, unknown>) => {
      const startTs = call.start_timestamp as number | string | undefined
      const endTs = call.end_timestamp as number | string | undefined
      const startMs = startTs != null ? new Date(startTs).getTime() : NaN
      const endMs = endTs != null ? new Date(endTs).getTime() : NaN
      return {
        id: call.call_id as string,
        callId: call.call_id as string,
        agentId: call.agent_id as string,
        agentName: (call.agent_name as string) || 'Unknown Agent',
        status: mapRetellStatus(call.call_status as string),
        direction: call.direction === 'inbound' ? 'inbound' : 'outbound',
        duration:
          Number.isFinite(endMs) && Number.isFinite(startMs)
            ? Math.floor((endMs - startMs) / 1000)
            : 0,
        startTime: Number.isFinite(startMs) ? new Date(startMs).toISOString() : '',
        endTime: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
        fromNumber: (call.from_number as string) || '',
        toNumber: (call.to_number as string) || '',
      }
    })

    const metrics = calculateMetrics(calls)

    return NextResponse.json({
      data: {
        calls,
        metrics,
        hourlyData: generateHourlyData(calls),
        dailyData: generateDailyData(calls),
        durationBuckets: generateDurationBuckets(calls),
        heatmapData: generateHeatmapData(calls),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: {
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
        },
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
