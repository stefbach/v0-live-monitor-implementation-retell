import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// Auto-chase: patients with no documents for 7 days get the reminder burst
// (email + WhatsApp relance) and are assigned to a coordinator to call.
//
// Safety by design:
//   NHS_AUTOCHASE_MODE = 'off' (default — does nothing) | 'dryrun' (detect &
//     report, no writes/sends) | 'live' (chase for real).
//   NHS_AUTOCHASE_DAILY_CAP caps how many patients a single run will process.
//   The candidate view already excludes opt-outs and anyone chased before
//     (one cycle per patient), and each n8n webhook no-ops when its URL is unset.
const MODE = (process.env.NHS_AUTOCHASE_MODE ?? 'off').toLowerCase()
const DAILY_CAP = (() => {
  const n = Number(process.env.NHS_AUTOCHASE_DAILY_CAP ?? '50')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50
})()
const DEFAULT_COORDINATOR = 'Summer'
const WEBHOOK_TIMEOUT_MS = 12_000

type CandidateRow = {
  lead_id: string
  dossier_id: string | null
  nom: string | null
  email: string | null
  numero_telephone: string | null
  dossier_status: string | null
  no_docs_since: string | null
}

async function postWebhook(envName: string, payload: unknown): Promise<'sent' | 'skipped' | 'error'> {
  const url = (process.env[envName] ?? '').trim()
  if (!url) return 'skipped'
  const token = (process.env.N8N_WEBHOOK_TOKEN ?? '').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-webhook-token': token } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    return res.ok ? 'sent' : 'error'
  } catch {
    return 'error'
  } finally {
    clearTimeout(timer)
  }
}

async function handler(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (MODE !== 'dryrun' && MODE !== 'live') {
    return NextResponse.json({ ok: true, mode: MODE, skipped: 'auto-chase disabled' })
  }

  try {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('nhs_chase_candidates')
      .select('lead_id, dossier_id, nom, email, numero_telephone, dossier_status, no_docs_since')
      .limit(DAILY_CAP)
    if (error) throw error
    const candidates = (data ?? []) as CandidateRow[]

    if (MODE === 'dryrun') {
      return NextResponse.json({
        ok: true,
        mode: 'dryrun',
        candidates: candidates.length,
        would_chase: candidates.map(c => ({ lead_id: c.lead_id, since: c.no_docs_since })),
      })
    }

    // ── live ──────────────────────────────────────────────────────────────────
    const requested_at = new Date().toISOString()
    let processed = 0
    let notConfigured = 0
    for (const c of candidates) {
      const base = {
        dossier_id: c.dossier_id,
        lead_id: c.lead_id,
        patient: { name: c.nom, email: c.email, phone: c.numero_telephone },
        source: 'auto-chase',
        requested_at,
      }

      const emailRes = await postWebhook('N8N_WEBHOOK_RELANCE_EMAIL', { action: 'relance-email', ...base })
      const waRes = await postWebhook('N8N_WEBHOOK_RELANCE_WHATSAPP', { action: 'relance-whatsapp', ...base })

      // If the send webhooks aren't configured, behave like a dry run for this
      // patient: don't assign and don't mark as chased, so nobody is silently
      // skipped before the live sends actually work.
      if (emailRes === 'skipped' && waRes === 'skipped') {
        notConfigured++
        continue
      }

      await sb.from('dashboard_assignments').insert({
        lead_id: c.lead_id,
        assigned_to: DEFAULT_COORDINATOR,
        assigned_by: 'auto-chase',
        reason: 'No documents received for 7 days — call patient',
        status: 'open',
      })
      await postWebhook('N8N_WEBHOOK_NOTIFY_COORDINATOR', {
        coordinator: DEFAULT_COORDINATOR,
        lead_id: c.lead_id,
        patient: base.patient,
        reason: 'No documents received for 7 days',
        requested_at,
      })
      // Idempotency: one auto cycle per patient, then it's the coordinator's.
      await sb.from('leads_rdv').update({ last_doc_chase_at: requested_at }).eq('id', c.lead_id)
      processed++
    }

    return NextResponse.json({
      ok: true,
      mode: 'live',
      candidates: candidates.length,
      processed,
      skipped_not_configured: notConfigured,
    })
  } catch (err) {
    console.error('[cron/nhs-chase]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
