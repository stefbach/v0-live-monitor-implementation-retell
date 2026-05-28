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

    const [leadsRes, dossiersRes, objectiveRes] = await Promise.all([
      sb
        .from('leads_testflow_2')
        .select('email_sent, whatsapp_sent')
        .not('email', 'is', null)
        .is('raison_ne_pas_rappeler', null),

      sb
        .from('nhs_dossiers')
        .select(
          'dossier_status, submission_ready, nhs_submission_status, bank_statement_exception, last_analysed_at'
        ),

      sb
        .from('nhs_monthly_objective')
        .select('target')
        .eq('month', new Date().toISOString().slice(0, 7) + '-01')
        .maybeSingle(),
    ])

    // leads_testflow_2 is a slim test table: no relance/response tracking.
    type LeadRow = {
      email_sent: boolean | null
      whatsapp_sent: boolean | null
    }

    type DossierRow = {
      dossier_status: string | null
      submission_ready: boolean | null
      nhs_submission_status: string | null
      bank_statement_exception: boolean | null
      last_analysed_at: string | null
    }

    const leads = (leadsRes.data ?? []) as LeadRow[]
    const dossiers = (dossiersRes.data ?? []) as DossierRow[]
    const target = (objectiveRes.data as { target?: number } | null)?.target ?? 30

    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = lastDay.getDate() - now.getDate()

    const stats = {
      initial_email_sent:    leads.filter(l => l.email_sent).length,
      initial_whatsapp_sent: leads.filter(l => l.whatsapp_sent).length,
      // Relance/response tracking does not exist on leads_testflow_2.
      relance_email_sent:    0,
      relance_whatsapp_sent: 0,
      responses_received:    0,
      no_response_3j:        0,

      no_docs:        dossiers.filter(d => d.dossier_status === 'NO_DOCUMENTS_RECEIVED').length,
      partial_docs:   dossiers.filter(d => d.dossier_status === 'MISSING_DOCUMENTS').length,
      complete_docs:  dossiers.filter(d =>
        d.dossier_status === 'COMPLETE' || d.dossier_status === 'READY_TO_SUBMIT'
      ).length,
      ready_to_submit: dossiers.filter(d => d.submission_ready).length,
      submitted:       dossiers.filter(d => d.dossier_status === 'SUBMITTED').length,

      sent_nhs:        dossiers.filter(d => d.nhs_submission_status != null).length,
      in_review:       dossiers.filter(d => d.nhs_submission_status === 'in_review').length,
      additional_info: dossiers.filter(d => d.nhs_submission_status === 'additional_info').length,
      accepted:        dossiers.filter(d => d.nhs_submission_status === 'accepted').length,
      refused:         dossiers.filter(d => d.nhs_submission_status === 'refused').length,
      bank_exceptions: dossiers.filter(d => d.bank_statement_exception).length,

      monthly_target: target,
      days_remaining: daysRemaining,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[nhs-stats]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
