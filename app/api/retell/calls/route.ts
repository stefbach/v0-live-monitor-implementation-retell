import { NextResponse } from 'next/server'
import type {
  CallLogEnriched,
  ApiResponse,
  Lead,
} from '@/lib/types'
import {
  getMockCallLogs,
  getMockActiveCalls,
} from '@/lib/mock-data'
import { getAgentNameMap } from '@/lib/agents'
import { fetchAllLeads, indexLeadsByPhone, toLeadSummary } from '@/lib/leads'
import { normalizePhone, pickCounterpartyNumber } from '@/lib/phone'
import { supabaseConfigured } from '@/lib/supabase'
import { getUKParts, getCreneau } from '@/lib/timezone'
import { detectRobotAwareness, detectVoicemailSuspected } from '@/lib/detection'
import type { CallMetadataInfo, CallCustomAnalysis } from '@/lib/types'

function extractMetadata(call: Record<string, unknown>): CallMetadataInfo | null {
  const m = call.metadata as Record<string, unknown> | undefined
  if (!m || typeof m !== 'object') return null
  const num = (v: unknown): number | null =>
    typeof v === 'number' ? v : v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null
  return {
    leadId: (m.lead_id as string) ?? null,
    phase: (m.phase as string) ?? null,
    today: (m.today as string) ?? null,
    j1Attempts: num(m.j1_attempts),
    j3Attempts: num(m.j3_attempts),
    j5Attempts: num(m.j5_attempts),
  }
}

function extractCustomAnalysis(
  call: Record<string, unknown>
): { analysis: CallCustomAnalysis | null; inVoicemail: boolean | null } {
  const ca = call.call_analysis as Record<string, unknown> | undefined
  if (!ca || typeof ca !== 'object') return { analysis: null, inVoicemail: null }
  const cad = ca.custom_analysis_data as Record<string, unknown> | undefined
  const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
  const inVoicemail = typeof ca.in_voicemail === 'boolean' ? ca.in_voicemail : null
  if (!cad || typeof cad !== 'object') return { analysis: null, inVoicemail }
  return {
    inVoicemail,
    analysis: {
      callOutcome: str(cad.call_outcome),
      interestLevel: str(cad.interest_level),
      objectionsRaised: str(cad.objections_raised),
      callbackScheduled: bool(cad.callback_scheduled),
      callbackDatetime: str(cad.callback_datetime),
      transferToIsabelle: bool(cad.transfer_to_isabelle),
      humanTransferTriggered: bool(cad.human_transfer_triggered),
      availability: str(cad.availability),
      mainConcern: str(cad.main_concern),
      emotionalState: str(cad.emotional_state),
    },
  }
}

export const dynamic = 'force-dynamic'

interface RichCallsResponse {
  calls: CallLogEnriched[]
  leads: Lead[]
  agentNames: Record<string, string>
}

const EMPTY: RichCallsResponse = { calls: [], leads: [], agentNames: {} }

const NO_ANSWER_DISCONNECTS = new Set([
  'dial_no_answer',
  'voicemail',
  'dial_busy',
  'dial_failed',
  'no_valid_payment',
  'inactivity',
])

function isAnswered(durationSec: number, disconnect: string | null): boolean {
  if (durationSec < 15) return false
  if (disconnect && NO_ANSWER_DISCONNECTS.has(disconnect)) return false
  return true
}

export async function GET(): Promise<NextResponse<ApiResponse<RichCallsResponse>>> {
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const mockCalls = getMockCallLogs()
    const activeCalls = getMockActiveCalls()
    const enriched: CallLogEnriched[] = mockCalls.map((c) => {
      const startMs = new Date(c.startTime).getTime()
      const uk = getUKParts(Number.isFinite(startMs) ? startMs : undefined)
      return {
        ...c,
        cost: null,
        lead: null,
        disconnectionReason: null,
        attemptNumber: 1,
        answered: c.duration >= 15,
        hourOfDay: uk?.hour ?? 0,
        dayOfWeek: uk?.dayOfWeek ?? 0,
        creneau: getCreneau(uk?.hour ?? -1, uk?.minute ?? 0),
        meta: null,
        analysis: null,
        inVoicemail: null,
        voicemailSuspected: false,
        robotAwareness: null,
      }
    })
    void activeCalls
    return NextResponse.json({
      data: { calls: enriched, leads: [], agentNames: {} },
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
        body: JSON.stringify({ limit: 1000, sort_order: 'descending' }),
      }),
      supabaseConfigured() ? fetchAllLeads() : Promise.resolve([] as Lead[]),
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

    // Build prelim calls (no attemptNumber yet)
    type Prelim = CallLogEnriched & { _key: string; _ts: number }
    const prelim: Prelim[] = callsRaw.map((call) => {
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
      const normPhone = normalizePhone(counterparty)
      const lead = leadByPhone.get(normPhone) ?? null
      const costObj = call.call_cost as { combined_cost?: number } | undefined
      const cost =
        typeof costObj?.combined_cost === 'number' ? costObj.combined_cost : null
      const disconnectionReason = (call.disconnection_reason as string) || null
      const transcriptObj = call.transcript_object as unknown[] | undefined
      const recordingUrl = (call.recording_url as string) || undefined
      const summary =
        ((call.call_analysis as { call_summary?: string })?.call_summary as string) ||
        (call.call_summary as string) ||
        undefined
      const sentiment = (call.call_analysis as { user_sentiment?: string })
        ?.user_sentiment as 'positive' | 'neutral' | 'negative' | undefined
      const meta = extractMetadata(call)
      const { analysis, inVoicemail } = extractCustomAnalysis(call)
      const ukParts = getUKParts(Number.isFinite(startMs) ? startMs : undefined)
      const ukHour = ukParts?.hour ?? 0
      const ukDow = ukParts?.dayOfWeek ?? 0
      const creneau = getCreneau(ukParts?.hour ?? -1, ukParts?.minute ?? 0)
      const voicemailSuspected = detectVoicemailSuspected(
        inVoicemail,
        duration,
        disconnectionReason
      )
      // list-calls rarely includes the full transcript → best-effort scan on
      // the summary here; the definitive check happens on click via get-call.
      const robotAwareness = summary ? detectRobotAwareness(summary) || null : null

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
        sentiment,
        cost,
        lead: lead ? toLeadSummary(lead) : null,
        disconnectionReason,
        attemptNumber: 1, // filled below
        answered: isAnswered(duration, disconnectionReason),
        hourOfDay: ukHour,
        dayOfWeek: ukDow,
        creneau,
        meta,
        analysis,
        inVoicemail,
        voicemailSuspected,
        robotAwareness,
        transcript: Array.isArray(transcriptObj)
          ? transcriptObj.map((t, i) => mapTranscript(t, i))
          : undefined,
        _key: normPhone || (lead?.id ?? ''),
        _ts: Number.isFinite(startMs) ? startMs : 0,
      }
    })

    // Compute attemptNumber: per-lead chronological order
    const byKey = new Map<string, Prelim[]>()
    for (const c of prelim) {
      if (!c._key) continue
      if (!byKey.has(c._key)) byKey.set(c._key, [])
      byKey.get(c._key)!.push(c)
    }
    for (const list of byKey.values()) {
      list.sort((a, b) => a._ts - b._ts)
      list.forEach((c, i) => (c.attemptNumber = i + 1))
    }

    const calls: CallLogEnriched[] = prelim.map(({ _key, _ts, ...c }) => {
      void _key
      void _ts
      return c
    })

    return NextResponse.json({
      data: { calls, leads, agentNames },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: EMPTY,
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
