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
    // Fetch calls from Retell API
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Retell API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform Retell API response to our CallLog type
    const calls: CallLog[] = (data || []).map((call: Record<string, unknown>) => ({
      id: call.call_id as string,
      callId: call.call_id as string,
      agentId: call.agent_id as string,
      agentName: (call.agent_name as string) || 'Unknown Agent',
      status: mapRetellStatus(call.call_status as string),
      direction: call.direction === 'inbound' ? 'inbound' : 'outbound',
      duration: call.end_timestamp
        ? Math.floor(
            (new Date(call.end_timestamp as string).getTime() -
              new Date(call.start_timestamp as string).getTime()) /
              1000
          )
        : 0,
      startTime: call.start_timestamp as string,
      endTime: (call.end_timestamp as string) || null,
      fromNumber: (call.from_number as string) || '',
      toNumber: (call.to_number as string) || '',
    }))

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
