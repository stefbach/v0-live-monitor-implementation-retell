import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

// Inbound write-path for the flow that reads Dr Nedelcu's mailbox. n8n classifies
// each NHS reply (acknowledgement / request for more info / approval / rejection),
// finds the matching dossier, and POSTs the result here. We set the dossier's
// nhs_submission_status — which the dashboard already reads to drive the
// "NHS S2 tracking (after submission)" cards (Sent / In review / Additional info /
// Accepted / Refused). The status mapping lives here (one enum, validated) rather
// than being duplicated in the workflow.
//
// Security: this endpoint WRITES patient records, so it fails closed. It is only
// enabled once N8N_WEBHOOK_TOKEN is set, and every request must present it in the
// `x-webhook-token` header (the same shared secret the dashboard sends to n8n).

const NHS_STATUSES = ['in_review', 'additional_info', 'accepted', 'refused'] as const
type NhsStatus = (typeof NHS_STATUSES)[number]

// Accept a few natural aliases the mail classifier might emit, mapped to the enum.
const STATUS_ALIASES: Record<string, NhsStatus> = {
  in_review: 'in_review',
  review: 'in_review',
  acknowledged: 'in_review',
  received: 'in_review',
  additional_info: 'additional_info',
  'additional-info': 'additional_info',
  more_info: 'additional_info',
  info_request: 'additional_info',
  rfi: 'additional_info',
  accepted: 'accepted',
  approved: 'accepted',
  refused: 'refused',
  rejected: 'refused',
  declined: 'refused',
}

function normaliseStatus(raw: unknown): NhsStatus | null {
  if (typeof raw !== 'string') return null
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? null
}

function asIsoDate(v: unknown): string {
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return new Date(t).toISOString()
  }
  return new Date().toISOString()
}

export async function POST(req: Request) {
  try {
    // Fail closed: no shared secret configured → endpoint disabled.
    const expected = (process.env.N8N_WEBHOOK_TOKEN ?? '').trim()
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: 'Inbound disabled — N8N_WEBHOOK_TOKEN not configured' },
        { status: 503 },
      )
    }
    const presented = (req.headers.get('x-webhook-token') ?? '').trim()
    if (presented !== expected) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      dossier_id?: string
      lead_id?: string
      patient_name?: string
      response_date?: string
      note?: string
    }

    const status = normaliseStatus(body.status)
    if (!status) {
      return NextResponse.json(
        { ok: false, error: `Unknown status — expected one of ${NHS_STATUSES.join(', ')}` },
        { status: 400 },
      )
    }

    const sb = getSupabase()

    // Resolve the target dossier. Prefer explicit ids; fall back to an exact-ish
    // patient-name match, but refuse ambiguous matches so we never write the wrong
    // patient's record.
    let dossierId: string | null = null
    let leadId: string | null = null

    if (body.dossier_id) {
      const { data } = await sb
        .from('nhs_dossiers')
        .select('id, lead_id, nhs_submission_date')
        .eq('id', body.dossier_id)
        .maybeSingle()
      if (!data) return NextResponse.json({ ok: false, error: 'Dossier not found' }, { status: 404 })
      dossierId = (data as { id: string }).id
      leadId = (data as { lead_id: string | null }).lead_id
    } else if (body.lead_id) {
      leadId = body.lead_id
    } else if (body.patient_name && body.patient_name.trim()) {
      const name = body.patient_name.trim()
      const { data: matches } = await sb
        .from('leads_rdv')
        .select('id, nom')
        .ilike('nom', name)
        .limit(5)
      const rows = (matches ?? []) as { id: string; nom: string | null }[]
      if (rows.length === 0)
        return NextResponse.json({ ok: false, error: 'No patient matched that name' }, { status: 404 })
      if (rows.length > 1)
        return NextResponse.json(
          { ok: false, error: 'Ambiguous patient name — pass lead_id or dossier_id' },
          { status: 409 },
        )
      leadId = rows[0].id
    } else {
      return NextResponse.json(
        { ok: false, error: 'Provide dossier_id, lead_id, or patient_name' },
        { status: 400 },
      )
    }

    // If we resolved via lead, find that lead's dossier (if any yet).
    let existingSubmissionDate: string | null = null
    if (!dossierId && leadId) {
      const { data } = await sb
        .from('nhs_dossiers')
        .select('id, nhs_submission_date')
        .eq('lead_id', leadId)
        .maybeSingle()
      if (data) {
        dossierId = (data as { id: string }).id
        existingSubmissionDate = (data as { nhs_submission_date: string | null }).nhs_submission_date
      }
    }

    if (!dossierId) {
      return NextResponse.json(
        { ok: false, error: 'No NHS dossier exists for this patient yet' },
        { status: 404 },
      )
    }

    const when = asIsoDate(body.response_date)
    const update: Record<string, unknown> = {
      nhs_submission_status: status,
      nhs_response_date: when,
    }
    // Give the in-review SLA clock an anchor if the dossier was never stamped with a
    // submission date (e.g. the acknowledgement is the first signal we logged).
    if (status === 'in_review' && !existingSubmissionDate) {
      update.nhs_submission_date = when
    }

    const { error: upErr } = await sb.from('nhs_dossiers').update(update).eq('id', dossierId)
    if (upErr) throw upErr

    return NextResponse.json({ ok: true, dossier_id: dossierId, status })
  } catch (err) {
    console.error('[nhs-inbound]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
