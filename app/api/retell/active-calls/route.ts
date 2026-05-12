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
    const response = await fetch(
      'https://api.retellai.com/v2/list-calls?filter_criteria=%7B%22call_status%22%3A%5B%22ongoing%22%5D%7D',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Retell API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Transform Retell API response to our ActiveCall type
    const activeCalls: ActiveCall[] = (data || []).map((call: Record<string, unknown>) => ({
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
