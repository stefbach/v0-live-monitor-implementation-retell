import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NHS_DOCS, buildPatient } from '../route'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

export interface NhsPatientDetail {
  patient: ReturnType<typeof buildPatient>
  documents: Array<{ key: string; required: boolean; received: boolean }>
  timeline: Array<{
    kind: 'call' | 'email' | 'whatsapp' | 'doc' | 'response'
    date: string
    title_key: string
    detail: string | null
  }>
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

    const { data: dossier, error: dErr } = await sb
      .from('nhs_dossiers')
      .select(
        `id, lead_id, dossier_status, submission_ready, nhs_submission_status,
         bank_statement_exception, last_analysed_at, ${docCols}`,
      )
      .eq('id', id)
      .maybeSingle()

    if (dErr) throw dErr
    if (!dossier) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    type D = Record<string, unknown> & {
      id: string
      lead_id: string | null
      dossier_status: string | null
      submission_ready: boolean | null
      nhs_submission_status: string | null
      bank_statement_exception: boolean | null
      last_analysed_at: string | null
    }
    const d = dossier as D
    if (!d.lead_id) return NextResponse.json({ error: 'Dossier has no lead_id' }, { status: 400 })

    const { data: leadRow, error: lErr } = await sb
      .from('leads_rdv')
      .select(
        'id, nom, email, numero_telephone, patient_dob, email_sent, whatsapp_sent,' +
          ' relance_email_sent, relance_whatsapp_sent, relance_email_date,' +
          ' last_response_date, last_call_datetime,' +
          ' first_mail:"1st_mail", second_mail:"2nd_mail"',
      )
      .eq('id', d.lead_id)
      .maybeSingle()

    if (lErr) throw lErr
    if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

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
      last_response_date: string | null
      last_call_datetime: string | null
      first_mail: string | null
      second_mail: string | null
    }
    const l = leadRow as L

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const patient = buildPatient(d, l, threeDaysAgo)

    const documents = NHS_DOCS.map(doc => ({
      key: doc.key,
      required: doc.required,
      received: d[doc.key] === true,
    }))

    const timeline: NhsPatientDetail['timeline'] = []
    if (l.last_call_datetime) {
      timeline.push({
        kind: 'call',
        date: l.last_call_datetime,
        title_key: 'nhs.detail.timeline.initialCall',
        detail: null,
      })
    }
    if (l.email_sent && l.first_mail) {
      timeline.push({
        kind: 'email',
        date: l.first_mail,
        title_key: 'nhs.detail.timeline.initialEmail',
        detail: null,
      })
    }
    if (l.relance_email_sent && l.relance_email_date) {
      timeline.push({
        kind: 'email',
        date: l.relance_email_date,
        title_key: 'nhs.detail.timeline.relanceEmail',
        detail: null,
      })
    }
    if (l.relance_whatsapp_sent && l.relance_email_date) {
      timeline.push({
        kind: 'whatsapp',
        date: l.relance_email_date,
        title_key: 'nhs.detail.timeline.relanceWhatsapp',
        detail: null,
      })
    }
    if (l.last_response_date) {
      timeline.push({
        kind: 'response',
        date: l.last_response_date,
        title_key: 'nhs.detail.timeline.response',
        detail: null,
      })
    }
    if (d.last_analysed_at) {
      timeline.push({
        kind: 'doc',
        date: d.last_analysed_at,
        title_key: 'nhs.detail.timeline.docsAnalysed',
        detail: `${patient.docs_received} / ${patient.docs_required}`,
      })
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ patient, documents, timeline })
  } catch (err) {
    console.error('[nhs-patients/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
