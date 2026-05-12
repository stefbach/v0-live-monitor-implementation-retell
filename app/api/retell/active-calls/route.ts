import { NextResponse } from 'next/server'
import type { ActiveCall, ApiResponse } from '@/lib/types'
import { getMockActiveCalls } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse<ActiveCall[]>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const activeCalls = getMockActiveCalls()
    return NextResponse.json({
      data: activeCalls,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // v2/list-calls is a POST endpoint with a JSON body
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter_criteria: { call_status: ['ongoing'] },
        limit: 1000,
        sort_order: 'descending',
      }),
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

    // Transform Retell API response to our ActiveCall type
    const activeCalls: ActiveCall[] = callsRaw.map((call: Record<string, unknown>) => ({
      id: call.call_id as string,
      callId: call.call_id as string,
      agentId: call.agent_id as string,
      agentName: (call.agent_name as string) || 'Unknown Agent',
      direction: call.direction === 'inbound' ? 'inbound' : 'outbound',
      startTime: call.start_timestamp as string,
      fromNumber: (call.from_number as string) || '',
      toNumber: (call.to_number as string) || '',
      currentDuration: Math.floor(
        (Date.now() - new Date(call.start_timestamp as string).getTime()) / 1000
      ),
      status: 'active' as const,
    }))

    return NextResponse.json({
      data: activeCalls,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch active calls',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
