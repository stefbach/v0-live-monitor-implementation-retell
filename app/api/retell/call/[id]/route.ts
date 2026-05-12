import { NextResponse } from 'next/server'
import type { CallLog, ApiResponse } from '@/lib/types'
import { getMockCallById } from '@/lib/mock-data'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<CallLog | null>>> {
  const { id } = await params
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const call = getMockCallById(id)
    if (!call) {
      return NextResponse.json(
        {
          data: null,
          error: 'Call not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }
    return NextResponse.json({
      data: call,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const response = await fetch(`https://api.retellai.com/v2/get-call/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          {
            data: null,
            error: 'Call not found',
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        )
      }
      throw new Error(`Retell API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform Retell API response to our CallLog type
    const call: CallLog = {
      id: data.call_id,
      callId: data.call_id,
      agentId: data.agent_id,
      agentName: data.agent_name || 'Unknown Agent',
      status: mapRetellStatus(data.call_status),
      direction: data.direction === 'inbound' ? 'inbound' : 'outbound',
      duration: data.end_timestamp
        ? Math.floor(
            (new Date(data.end_timestamp).getTime() -
              new Date(data.start_timestamp).getTime()) /
              1000
          )
        : 0,
      startTime: data.start_timestamp,
      endTime: data.end_timestamp || null,
      fromNumber: data.from_number || '',
      toNumber: data.to_number || '',
      transcript: data.transcript?.map(
        (t: { role: string; content: string; timestamp?: number }, i: number) => ({
          id: `seg-${i}`,
          speaker: t.role === 'agent' ? 'agent' : 'user',
          text: t.content,
          startTime: t.timestamp || i * 5,
          endTime: (t.timestamp || i * 5) + 5,
        })
      ),
      recordingUrl: data.recording_url,
      summary: data.call_analysis?.call_summary,
      sentiment: data.call_analysis?.user_sentiment,
    }

    return NextResponse.json({
      data: call,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch call',
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
