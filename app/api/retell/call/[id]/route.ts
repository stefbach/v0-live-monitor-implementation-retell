import { NextResponse } from 'next/server'
import type { CallLogEnriched, ApiResponse, Lead } from '@/lib/types'
import { getMockCallById } from '@/lib/mock-data'
import { getAgentNameMap } from '@/lib/agents'
import { getSupabaseServer, supabaseConfigured } from '@/lib/supabase'
import { normalizePhone, pickCounterpartyNumber } from '@/lib/phone'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<(CallLogEnriched & { fullLead?: Lead | null }) | null>>> {
  const { id } = await params
  const apiKeyConfigured = !!process.env.RETELL_API_KEY
  const useMockData = process.env.USE_MOCK_DATA === 'true' || !apiKeyConfigured

  if (useMockData) {
    const call = getMockCallById(id)
    if (!call) {
      return NextResponse.json(
        { data: null, error: 'Call not found', timestamp: new Date().toISOString() },
        { status: 404 }
      )
    }
    const startMs = new Date(call.startTime).getTime()
    const d = Number.isFinite(startMs) ? new Date(startMs) : new Date(0)
    return NextResponse.json({
      data: {
        ...call,
        cost: null,
        lead: null,
        fullLead: null,
        disconnectionReason: null,
        attemptNumber: 1,
        answered: call.duration >= 15,
        hourOfDay: d.getHours(),
        dayOfWeek: d.getDay(),
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const [response, agentNames] = await Promise.all([
      fetch(`https://api.retellai.com/v2/get-call/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }),
      getAgentNameMap(),
    ])

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { data: null, error: 'Call not found', timestamp: new Date().toISOString() },
          { status: 404 }
        )
      }
      throw new Error(`Retell API error: ${response.status}`)
    }

    const data = (await response.json()) as Record<string, unknown>
    const startTs = data.start_timestamp as number | string | undefined
    const endTs = data.end_timestamp as number | string | undefined
    const startMs = startTs != null ? new Date(startTs).getTime() : NaN
    const endMs = endTs != null ? new Date(endTs).getTime() : NaN
    const direction = data.direction === 'inbound' ? 'inbound' : 'outbound'
    const fromNumber = (data.from_number as string) || ''
    const toNumber = (data.to_number as string) || ''
    const agentId = (data.agent_id as string) || ''
    const costObj = data.call_cost as { combined_cost?: number } | undefined
    const cost =
      typeof costObj?.combined_cost === 'number' ? costObj.combined_cost : null
    const disconnectionReason = (data.disconnection_reason as string) || null
    const duration =
      Number.isFinite(endMs) && Number.isFinite(startMs)
        ? Math.floor((endMs - startMs) / 1000)
        : 0
    const startDate = Number.isFinite(startMs) ? new Date(startMs) : new Date(0)
    const NO_ANSWER = new Set([
      'dial_no_answer',
      'voicemail',
      'dial_busy',
      'dial_failed',
      'no_valid_payment',
      'inactivity',
    ])
    const answered =
      duration >= 15 && !(disconnectionReason && NO_ANSWER.has(disconnectionReason))

    // Lookup the lead via phone
    const counterparty = pickCounterpartyNumber(direction, fromNumber, toNumber)
    const phone = normalizePhone(counterparty)
    let fullLead: Lead | null = null
    if (phone && supabaseConfigured()) {
      const supabase = getSupabaseServer()!
      const { data: leadRows } = await supabase
        .from('leads_rdv')
        .select('*')
        .or(`numero_telephone.eq.${phone},numero_telephone.eq.${counterparty}`)
        .limit(1)
      if (leadRows && leadRows[0]) {
        const r = leadRows[0] as Record<string, unknown>
        fullLead = {
          id: r.id as string,
          nom: (r.nom as string) ?? null,
          email: (r.email as string) ?? null,
          numero_telephone: (r.numero_telephone as string) ?? null,
          poids: toNum(r.poids),
          taille: toNum(r.taille),
          bmi: toNum(r.bmi),
          source_lead: (r.source_lead as string) ?? null,
          form_facebook: (r.form_facebook as string) ?? null,
          agent: (r.agent as string) ?? null,
          date_rdv: (r.date_rdv as string) ?? null,
          date_creation: (r.date_creation as string) ?? null,
          qualification: (r.qualification as string) ?? null,
          note: (r.note as string) ?? null,
          rappel_rdv: (r.rappel_rdv as string) ?? null,
          call_count: toNum(r.call_count),
          last_qualification_update: (r.last_qualification_update as string) ?? null,
          first_mail: (r['1st_mail'] as string) ?? null,
          second_mail: (r['2nd_mail'] as string) ?? null,
          allergies: (r.allergies as string) ?? null,
          anesthesia_allergies: (r.anesthesia_allergies as string) ?? null,
          current_medications: (r.current_medications as string) ?? null,
          past_surgeries: (r.past_surgeries as string) ?? null,
          nhs_wmp_status: (r.nhs_wmp_status as string) ?? null,
          nhs_wmp_details: (r.nhs_wmp_details as string) ?? null,
          other_chronic_conditions: (r.other_chronic_conditions as string) ?? null,
          patient_dob: (r.patient_dob as string) ?? null,
          email_sent: (r.email_sent as boolean) ?? null,
          last_call_datetime: (r.last_call_datetime as string) ?? null,
          call_1_note: (r.call_1_note as string) ?? null,
          call_2_note: (r.call_2_note as string) ?? null,
          call_3_note: (r.call_3_note as string) ?? null,
        }
      }
    }

    const transcriptArr = (data.transcript_object as unknown[]) || (data.transcript as unknown[])
    const call: CallLogEnriched & { fullLead?: Lead | null } = {
      id: (data.call_id as string) || id,
      callId: (data.call_id as string) || id,
      agentId,
      agentName: agentNames[agentId] || (data.agent_name as string) || 'Unknown Agent',
      status: mapRetellStatus(data.call_status as string),
      direction,
      duration,
      startTime: Number.isFinite(startMs) ? new Date(startMs).toISOString() : '',
      endTime: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
      fromNumber,
      toNumber,
      userName: fullLead?.nom ?? undefined,
      recordingUrl: (data.recording_url as string) || undefined,
      summary:
        ((data.call_analysis as { call_summary?: string })?.call_summary as string) ||
        (data.call_summary as string) ||
        undefined,
      sentiment: ((data.call_analysis as { user_sentiment?: string })?.user_sentiment as
        | 'positive'
        | 'neutral'
        | 'negative'
        | undefined) ?? undefined,
      cost,
      disconnectionReason,
      attemptNumber: 1,
      answered,
      hourOfDay: startDate.getHours(),
      dayOfWeek: startDate.getDay(),
      lead: fullLead
        ? {
            id: fullLead.id,
            nom: fullLead.nom,
            email: fullLead.email,
            numero_telephone: fullLead.numero_telephone,
            bmi: fullLead.bmi,
            poids: fullLead.poids,
            taille: fullLead.taille,
            patient_dob: fullLead.patient_dob,
            qualification: fullLead.qualification,
            source_lead: fullLead.source_lead,
            call_count: fullLead.call_count,
            date_rdv: fullLead.date_rdv,
            rappel_rdv: fullLead.rappel_rdv,
            last_call_datetime: fullLead.last_call_datetime,
          }
        : null,
      fullLead,
      transcript: Array.isArray(transcriptArr)
        ? transcriptArr.map((t, i) => {
            const o = (t as Record<string, unknown>) || {}
            const role = (o.role as string) === 'user' ? 'user' : 'agent'
            return {
              id: `seg-${i}`,
              speaker: role as 'agent' | 'user',
              text: (o.content as string) || '',
              startTime: typeof o.start === 'number' ? o.start : (o.timestamp as number) || i * 5,
              endTime: typeof o.end === 'number' ? o.end : ((o.timestamp as number) || i * 5) + 5,
            }
          })
        : undefined,
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

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
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
