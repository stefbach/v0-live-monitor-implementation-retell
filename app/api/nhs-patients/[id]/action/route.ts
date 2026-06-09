import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NHS_DOCS } from '../../route'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

const ACTIONS = ['relance-email', 'relance-whatsapp', 'submit-nhs'] as const
type Action = (typeof ACTIONS)[number]

// Each dashboard action maps to one n8n webhook. The URLs live in server-only
// env vars (never NEXT_PUBLIC) so they are never exposed to the browser, and the
// browser never talks to n8n directly. When a URL is unset we run in "simulated"
// mode: the request succeeds end-to-end but nothing is actually sent — this lets
// the dashboard be wired and tested before the live n8n webhooks are switched on.
const WEBHOOK_ENV: Record<Action, string> = {
  'relance-email': 'N8N_WEBHOOK_RELANCE_EMAIL',
  'relance-whatsapp': 'N8N_WEBHOOK_RELANCE_WHATSAPP',
  'submit-nhs': 'N8N_WEBHOOK_NHS_SUBMIT',
}

const WEBHOOK_TIMEOUT_MS = 12_000

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  try {
    const params = await (ctx as { params: Promise<{ id: string }> }).params
    const id = params.id

    const body = (await req.json().catch(() => ({}))) as { action?: string }
    const action = body.action
    if (!action || !ACTIONS.includes(action as Action)) {
      return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
    }
    const act = action as Action

    const sb = getSupabase()
    const docCols = NHS_DOCS.map(d => d.key).join(', ')

    // `id` may be a dossier id, or a lead id for an emailed patient that has no
    // dossier yet (mirrors the GET detail route). Resolve to the lead either way.
    const { data: dossier, error: dErr } = await sb
      .from('nhs_dossiers')
      .select(
        `id, lead_id, dossier_status, submission_ready, nhs_submission_status,
         bank_statement_exception, last_analysed_at, ${docCols}`,
      )
      .eq('id', id)
      .maybeSingle()
    if (dErr) throw dErr

    const d = dossier as
      | (Record<string, unknown> & {
          id: string
          lead_id: string | null
          dossier_status: string | null
          submission_ready: boolean | null
        })
      | null
    const leadId = d?.lead_id ?? id

    const { data: lead, error: lErr } = await sb
      .from('leads_rdv')
      .select('id, nom, email, numero_telephone')
      .eq('id', leadId)
      .maybeSingle()
    if (lErr) throw lErr
    if (!lead) return NextResponse.json({ ok: false, error: 'Patient not found' }, { status: 404 })
    const l = lead as {
      id: string
      nom: string | null
      email: string | null
      numero_telephone: string | null
    }

    // Server-side gate: NHS submission requires a complete dossier. The button is
    // also disabled client-side, but an outward action must never trust the client.
    if (act === 'submit-nhs') {
      const required = NHS_DOCS.filter(x => x.required)
      const received = d
        ? required.filter(x => (d as Record<string, unknown>)[x.key] === 'received').length
        : 0
      const complete =
        d != null &&
        (received >= required.length ||
          d.submission_ready === true ||
          ['COMPLETE', 'READY_TO_SUBMIT', 'SUBMITTED'].includes(d.dossier_status ?? ''))
      if (!complete) {
        return NextResponse.json(
          { ok: false, error: 'Dossier is not complete — cannot submit to NHS' },
          { status: 409 },
        )
      }
    }

    const url = (process.env[WEBHOOK_ENV[act]] ?? '').trim()

    const payload = {
      action: act,
      dossier_id: d?.id ?? null,
      lead_id: l.id,
      patient: { name: l.nom, email: l.email, phone: l.numero_telephone },
      source: 'live-monitor-dashboard',
      requested_at: new Date().toISOString(),
    }

    // No webhook URL configured → simulated success (test mode, nothing sent).
    if (!url) {
      return NextResponse.json({ ok: true, simulated: true, action: act })
    }

    const token = (process.env.N8N_WEBHOOK_TOKEN ?? '').trim()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-webhook-token': token } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      return NextResponse.json(
        { ok: false, error: aborted ? 'Webhook timed out' : `Webhook request failed: ${String(e)}` },
        { status: 504 },
      )
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: `Webhook returned HTTP ${res.status}`, detail: detail.slice(0, 500) },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, simulated: false, action: act, status: res.status })
  } catch (err) {
    console.error('[nhs-patients/:id/action]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
