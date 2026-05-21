import { NextResponse } from 'next/server'
import type { ActiveCallEnriched, ApiResponse } from '@/lib/types'
import { getMockActiveCalls } from '@/lib/mock-data'
import { getAgentNameMap } from '@/lib/agents'
import { fetchAllLeads, indexLeadsByPhone, toLeadSummary } from '@/lib/leads'
import { normalizePhone, pickCounterpartyNumber } from '@/lib/phone'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse<ActiveCallEnriched[]>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const activeCalls = getMockActiveCalls()
    const enriched: ActiveCallEnriched[] = activeCalls.map((c) => ({ ...c, lead: null }))
    return NextResponse.json({
      data: enriched,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const [retellResponse, leads, agentNames] = await Promise.all([
      fetch('https://api.retellai.com/v2/list-calls', {
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

    // Robustness: only keep genuinely ongoing calls. If Retell ever ignores
    // filter_criteria and returns everything, this prevents the Live tab
    // from showing every historical call as "active".
    const ongoing = callsRaw.filter(
      (c) => (c.call_status as string | undefined) === 'ongoing'
    )

    const leadByPhone = indexLeadsByPhone(leads)

    const activeCalls: ActiveCallEnriched[] = ongoing.map((call) => {
      const startTs = call.start_timestamp as number | string | undefined
      const startMs = startTs != null ? new Date(startTs).getTime() : NaN
      const direction =
        call.direction === 'inbound' ? ('inbound' as const) : ('outbound' as const)
      const fromNumber = (call.from_number as string) || ''
      const toNumber = (call.to_number as string) || ''
      const agentId = (call.agent_id as string) || ''
      const counterparty = pickCounterpartyNumber(direction, fromNumber, toNumber)
      const lead = leadByPhone.get(normalizePhone(counterparty)) ?? null
      return {
        id: (call.call_id as string) || '',
        callId: (call.call_id as string) || '',
        agentId,
        agentName: agentNames[agentId] || (call.agent_name as string) || 'Unknown Agent',
        direction,
        startTime: Number.isFinite(startMs) ? new Date(startMs).toISOString() : '',
        fromNumber,
        toNumber,
        currentDuration: Number.isFinite(startMs)
          ? Math.floor((Date.now() - startMs) / 1000)
          : 0,
        status: 'active' as const,
        lead: lead ? toLeadSummary(lead) : null,
      }
    })

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
