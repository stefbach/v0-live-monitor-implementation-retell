import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NHS_DOCS, buildPatient, emptyDossier } from '../route'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

// Who a communication was with. The history must surface every interaction,
// grouped by counterparty: the patient, the clinic, the NHS, or the internal team.
type CommParty = 'patient' | 'clinic' | 'nhs' | 'team'
type CommKind = 'call' | 'email' | 'whatsapp' | 'doc' | 'response' | 'submission' | 'assignment'

export interface NhsPatientDetail {
  patient: ReturnType<typeof buildPatient>
  documents: Array<{ key: string; required: boolean; origin: string; received: boolean }>
  timeline: Array<{
    party: CommParty
    kind: CommKind
    date: string | null
    title_key: string
    name: string | null
    detail: string | null
    count: number
  }>
}

// Several "date" columns actually hold status strings (e.g. 1st_mail = 'sent').
// Only treat a value as a timestamp if it genuinely parses to one — otherwise the
// UI would render "Invalid Date". Undated-but-real events keep date = null.
function asDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return Number.isNaN(Date.parse(v)) ? null : v
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  try {
    const params = await (ctx as { params: Promise<{ id: string }> }).params
    const id = params.id

    const sb = getSupabase()
    const docCols = NHS_DOCS.map(d => d.key).join(', ')

    type D = Record<string, unknown> & {
      id: string
      lead_id: string | null
      dossier_status: string | null
      submission_ready: boolean | null
      nhs_submission_status: string | null
      bank_statement_exception: boolean | null
      last_analysed_at: string | null
      submission_email_sent: boolean | null
      submission_date: string | null
      submitted_by: string | null
      nhs_submission_date: string | null
      nhs_response_date: string | null
      documents_generated: boolean | null
      documents_generated_at: string | null
    }

    const { data: dossier, error: dErr } = await sb
      .from('nhs_dossiers')
      .select(
        `id, lead_id, dossier_status, submission_ready, nhs_submission_status,
         bank_statement_exception, last_analysed_at, submission_email_sent,
         submission_date, submitted_by, nhs_submission_date, nhs_response_date,
         documents_generated, documents_generated_at, ${docCols}`,
      )
      .eq('id', id)
      .maybeSingle()

    if (dErr) throw dErr

    // `id` may be a dossier id, or a lead id for an emailed patient that has no
    // dossier yet (these show as "no document" in the list). Fall back to the
    // lead in that case so the detail view still opens.
    let d: D
    let leadId: string
    const dossierId: string | null = dossier ? (dossier as D).id : null
    if (dossier) {
      d = dossier as D
      if (!d.lead_id) return NextResponse.json({ error: 'Dossier has no lead_id' }, { status: 400 })
      leadId = d.lead_id
    } else {
      d = emptyDossier(id) as D
      leadId = id
    }

    const { data: leadRow, error: lErr } = await sb
      .from('leads_rdv')
      .select(
        'id, nom, email, numero_telephone, patient_dob, email_sent, whatsapp_sent,' +
          ' relance_email_sent, relance_whatsapp_sent, relance_email_date, relance_whatsapp_date,' +
          ' last_response_date, last_call_datetime, last_updated, call_count,' +
          ' first_mail:"1st_mail", second_mail:"2nd_mail"',
      )
      .eq('id', leadId)
      .maybeSingle()

    if (lErr) throw lErr
    if (!leadRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    type L = {
      id: string
      nom: string | null
      email: string | null
      numero_telephone: string | null
      patient_dob: string | null
      email_sent: boolean | null
      whatsapp_sent: boolean | null
      relance_email_sent: boolean | null
      relance_whatsapp_sent: boolean | null
      relance_email_date: string | null
      relance_whatsapp_date: string | null
      last_response_date: string | null
      last_call_datetime: string | null
      last_updated: string | null
      call_count: number | null
      first_mail: string | null
      second_mail: string | null
    }
    const l = leadRow as L

    // The other two comms sources beyond the flag columns: the per-file document
    // registry (patient-supplied vs clinic-generated) and team escalation assignments.
    const docSelect = 'id, category, doc_field, file_name, source, status, received_at, created_at'
    const [docsRes, assignRes] = await Promise.all([
      dossierId
        ? sb.from('nhs_documents').select(docSelect).or(`lead_id.eq.${leadId},dossier_id.eq.${dossierId}`)
        : sb.from('nhs_documents').select(docSelect).eq('lead_id', leadId),
      sb
        .from('dashboard_assignments')
        .select('id, assigned_to, assigned_by, reason, assigned_at, status')
        .eq('lead_id', leadId),
    ])

    type DocRow = {
      id: string
      category: string | null
      doc_field: string | null
      file_name: string | null
      source: string | null
      status: string | null
      received_at: string | null
      created_at: string | null
    }
    type AssignRow = {
      id: string
      assigned_to: string | null
      assigned_by: string | null
      reason: string | null
      assigned_at: string | null
      status: string | null
    }
    const docRows = (docsRes.data ?? []) as DocRow[]
    const assignRows = (assignRes.data ?? []) as AssignRow[]

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const patient = buildPatient(d, l, threeDaysAgo)

    const documents = NHS_DOCS.map(doc => ({
      key: doc.key,
      required: doc.required,
      origin: doc.origin,
      received: d[doc.key] === 'received',
    }))

    const timeline: NhsPatientDetail['timeline'] = []
    const add = (
      party: CommParty,
      kind: CommKind,
      date: string | null,
      title_key: string,
      opts: { name?: string | null; detail?: string | null; count?: number } = {},
    ) => {
      timeline.push({
        party,
        kind,
        date,
        title_key,
        name: opts.name ?? null,
        detail: opts.detail ?? null,
        count: opts.count ?? 1,
      })
    }

    // ── Patient ──────────────────────────────────────────────────────────────
    if (l.last_call_datetime) {
      add('patient', 'call', l.last_call_datetime, 'nhs.detail.timeline.initialCall', {
        detail: l.call_count && l.call_count > 1 ? `${l.call_count}×` : null,
      })
    }
    if (l.email_sent) add('patient', 'email', asDate(l.first_mail), 'nhs.detail.timeline.initialEmail')
    if (l.second_mail) add('patient', 'email', asDate(l.second_mail), 'nhs.detail.timeline.secondEmail')
    if (l.whatsapp_sent) add('patient', 'whatsapp', null, 'nhs.detail.timeline.initialWhatsapp')
    if (l.relance_email_sent)
      add('patient', 'email', asDate(l.relance_email_date), 'nhs.detail.timeline.relanceEmail')
    if (l.relance_whatsapp_sent)
      add('patient', 'whatsapp', asDate(l.relance_whatsapp_date), 'nhs.detail.timeline.relanceWhatsapp')
    if (l.last_response_date)
      add('patient', 'response', l.last_response_date, 'nhs.detail.timeline.response')

    // ── Documents (patient-supplied vs clinic-generated) ──────────────────────
    // Collapse identical documents from the same day into one row with a count,
    // so a 3-file batch reads "Bank statements ×3" instead of three lines.
    const docGroups = new Map<
      string,
      { party: CommParty; date: string | null; name: string | null; count: number }
    >()
    for (const doc of docRows) {
      const generated = doc.source === 'generated'
      // Categories are stored like "5. Undue Delay" — drop the leading index.
      const raw = doc.category || doc.doc_field || doc.file_name || ''
      const name = raw.replace(/^\s*\d+[.)]\s*/, '').trim() || null
      const date = asDate(doc.received_at) ?? asDate(doc.created_at)
      const party: CommParty = generated ? 'clinic' : 'patient'
      const dayKey = date ? date.slice(0, 10) : 'undated'
      const key = `${party}|${name ?? ''}|${dayKey}`
      const g = docGroups.get(key)
      if (g) {
        g.count += 1
        if (date && (!g.date || date > g.date)) g.date = date
      } else {
        docGroups.set(key, { party, date, name, count: 1 })
      }
    }
    for (const g of docGroups.values()) {
      // Empty title_key → the document name is the headline; the party chip
      // conveys received (patient) vs prepared (clinic).
      add(g.party, 'doc', g.date, '', { name: g.name, count: g.count })
    }

    // ── Clinic / NHS / Team milestones ────────────────────────────────────────
    if (d.last_analysed_at) {
      add('team', 'doc', d.last_analysed_at, 'nhs.detail.timeline.docsAnalysed', {
        detail: `${patient.docs_received} / ${patient.docs_required}`,
      })
    }
    const submittedDate = asDate(d.nhs_submission_date) ?? asDate(d.submission_date)
    if (d.submission_email_sent || submittedDate || d.dossier_status === 'SUBMITTED') {
      add('nhs', 'submission', submittedDate, 'nhs.detail.timeline.nhsSubmitted', {
        detail: d.submitted_by ?? null,
      })
    }
    if (d.nhs_response_date || (d.nhs_submission_status && d.nhs_submission_status !== 'submitted')) {
      add('nhs', 'response', asDate(d.nhs_response_date), 'nhs.detail.timeline.nhsResponse', {
        detail: d.nhs_submission_status ?? null,
      })
    }
    for (const a of assignRows) {
      add('team', 'assignment', a.assigned_at, 'nhs.detail.timeline.assigned', {
        name: a.assigned_to,
        detail: a.reason,
      })
    }

    // Dated events newest-first; undated channel events (e.g. an initial email with
    // no stored timestamp) sink to the bottom rather than corrupting the order.
    timeline.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime()
      if (a.date) return -1
      if (b.date) return 1
      return 0
    })

    return NextResponse.json({ patient, documents, timeline })
  } catch (err) {
    console.error('[nhs-patients/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
