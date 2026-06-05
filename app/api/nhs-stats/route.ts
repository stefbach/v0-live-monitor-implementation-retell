import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sb = getSupabase()

    const [leadsRes, leadIdsRes, dossiersRes, objectiveRes] = await Promise.all([
      sb
        .from('leads_rdv')
        .select(
          'id, email_sent, whatsapp_sent, relance_email_sent, relance_whatsapp_sent, last_response_date, relance_email_date'
        )
        .not('email', 'is', null)
        .is('raison_ne_pas_rappeler', null),

      // All leads_rdv ids, used to exclude dossiers that belong to test
      // patients (those join to leads_testflow_2, not leads_rdv).
      sb.from('leads_rdv').select('id'),

      sb
        .from('nhs_dossiers')
        .select(
          'lead_id, dossier_status, submission_ready, nhs_submission_status, bank_statement_exception, last_analysed_at, doc_s2_provider_declaration, doc_medical_report, doc_undue_delay_letter, doc_detailed_medical_estimate'
        ),

      sb
        .from('nhs_monthly_objective')
        .select('target')
        .eq('month', new Date().toISOString().slice(0, 7) + '-01')
        .maybeSingle(),
    ])

    type LeadRow = {
      id: string
      email_sent: boolean | null
      whatsapp_sent: boolean | null
      relance_email_sent: boolean | null
      relance_whatsapp_sent: boolean | null
      last_response_date: string | null
      relance_email_date: string | null
    }

    type DossierRow = {
      lead_id: string | null
      dossier_status: string | null
      submission_ready: boolean | null
      nhs_submission_status: string | null
      bank_statement_exception: boolean | null
      last_analysed_at: string | null
      doc_s2_provider_declaration: string | null
      doc_medical_report: string | null
      doc_undue_delay_letter: string | null
      doc_detailed_medical_estimate: string | null
    }

    const leads = (leadsRes.data ?? []) as LeadRow[]
    const leadRdvIds = new Set(
      ((leadIdsRes.data ?? []) as { id: string }[]).map(r => r.id),
    )
    const dossiers = ((dossiersRes.data ?? []) as DossierRow[]).filter(
      d => d.lead_id != null && leadRdvIds.has(d.lead_id),
    )
    const target = (objectiveRes.data as { target?: number } | null)?.target ?? 30

    // File-status reconciliation: count over the *emailed* lead population so the
    // file-status buckets add up to "explanatory email sent". A patient who was
    // emailed but has no dossier yet (or an empty one) counts as "no document".
    const dossierByLead = new Map(
      dossiers.filter(d => d.lead_id != null).map(d => [d.lead_id as string, d]),
    )
    let fileNoDocs = 0
    let filePartial = 0
    let fileComplete = 0
    for (const l of leads) {
      if (!l.email_sent) continue
      const d = dossierByLead.get(l.id)
      const s = d?.dossier_status ?? null
      // Submitted / sent-to-NHS dossiers are tracked in the NHS section, not here.
      if (s === 'SUBMITTED' || (d?.nhs_submission_status ?? null) != null) continue
      if (s === 'COMPLETE' || s === 'READY_TO_SUBMIT' || d?.submission_ready) fileComplete++
      else if (s === 'MISSING_DOCUMENTS') filePartial++
      else fileNoDocs++
    }

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = lastDay.getDate() - now.getDate()

    const stats = {
      initial_email_sent:    leads.filter(l => l.email_sent).length,
      initial_whatsapp_sent: leads.filter(l => l.whatsapp_sent).length,
      relance_email_sent:    leads.filter(l => l.relance_email_sent).length,
      relance_whatsapp_sent: leads.filter(l => l.relance_whatsapp_sent).length,
      responses_received:    leads.filter(l => l.email_sent && l.last_response_date).length,
      no_response_3j:        leads.filter(l =>
        l.email_sent &&
        !l.last_response_date &&
        l.relance_email_sent &&
        l.relance_email_date &&
        new Date(l.relance_email_date) < threeDaysAgo
      ).length,

      no_docs:        fileNoDocs,
      partial_docs:   filePartial,
      complete_docs:  fileComplete,
      ready_to_submit: dossiers.filter(d => d.submission_ready).length,
      submitted:       dossiers.filter(d => d.dossier_status === 'SUBMITTED').length,

      sent_nhs:        dossiers.filter(d => d.nhs_submission_status != null).length,
      in_review:       dossiers.filter(d => d.nhs_submission_status === 'in_review').length,
      additional_info: dossiers.filter(d => d.nhs_submission_status === 'additional_info').length,
      accepted:        dossiers.filter(d => d.nhs_submission_status === 'accepted').length,
      refused:         dossiers.filter(d => d.nhs_submission_status === 'refused').length,
      bank_exceptions: dossiers.filter(d => d.bank_statement_exception).length,

      // Clinic-produced documents (received = produced / signed by the clinic).
      clinic_s2_provider:    dossiers.filter(d => d.doc_s2_provider_declaration === 'received').length,
      clinic_medical_report: dossiers.filter(d => d.doc_medical_report === 'received').length,
      clinic_undue_delay:    dossiers.filter(d => d.doc_undue_delay_letter === 'received').length,
      clinic_estimate:       dossiers.filter(d => d.doc_detailed_medical_estimate === 'received').length,

      monthly_target: target,
      days_remaining: daysRemaining,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[nhs-stats]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
