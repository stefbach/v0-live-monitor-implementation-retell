import { NextResponse } from 'next/server'
import type { RetellHealthStatus, ApiResponse } from '@/lib/types'

export async function GET(): Promise<NextResponse<ApiResponse<RetellHealthStatus>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    return NextResponse.json({
      data: {
        status: 'healthy',
        apiKeyConfigured: false,
        lastCheck: new Date().toISOString(),
        message: 'Running with mock data',
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Ping Retell API to check health
    const response = await fetch('https://api.retellai.com/v2/list-agents', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      return NextResponse.json({
        data: {
          status: 'healthy',
          apiKeyConfigured: true,
          lastCheck: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      data: {
        status: 'degraded',
        apiKeyConfigured: true,
        lastCheck: new Date().toISOString(),
        message: `API returned status ${response.status}`,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      data: {
        status: 'down',
        apiKeyConfigured: true,
        lastCheck: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    })
  }
}
