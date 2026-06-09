import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unassignLead } from '@/lib/dashboard'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

const COORDINATORS = ['Summer', 'Rain', 'Stormi'] as const
type Coordinator = (typeof COORDINATORS)[number]

const WEBHOOK_TIMEOUT_MS = 12_000

// Assign a patient to a coordinator to call. Writes a dashboard_assignments row
// (the dashboard's record, surfaced in the escalation alert + comms history) and,
// when configured, pings the coordinator over WhatsApp via n8n.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  try {
    const params = await (ctx as { params: Promise<{ id: string }> }).params
    const id = params.id

    const body = (await req.json().catch(() => ({}))) as {
      coordinator?: string
      reason?: string
      action?: string
    }

    const sb = getSupabase()

    // `id` may be a dossier id or a lead id — resolve to the lead either way.
    const { data: dossier } = await sb
      .from('nhs_dossiers')
      .select('id, lead_id')
      .eq('id', id)
      .maybeSingle()
    const leadId = (dossier as { lead_id: string | null } | null)?.lead_id ?? id

    // Unassign: close the lead's open assignment(s).
    if (body.action === 'unassign') {
      const res = await unassignLead(leadId)
      return NextResponse.json({ ok: res.ok, error: res.error }, { status: res.ok ? 200 : 500 })
    }

    const coordinator = body.coordinator
    if (!coordinator || !COORDINATORS.includes(coordinator as Coordinator)) {
      return NextResponse.json({ ok: false, error: 'Unknown coordinator' }, { status: 400 })
    }

    const { data: lead, error: lErr } = await sb
      .from('leads_rdv')
      .select('id, nom, email, numero_telephone')
      .eq('id', leadId)
      .maybeSingle()
    if (lErr) throw lErr
    if (!lead) return NextResponse.json({ ok: false, error: 'Patient not found' }, { status: 404 })
    const l = lead as { id: string; nom: string | null; email: string | null; numero_telephone: string | null }

    const reason = (body.reason ?? 'Assigned from dashboard').slice(0, 200)
    const { error: insErr } = await sb.from('dashboard_assignments').insert({
      lead_id: l.id,
      assigned_to: coordinator,
      assigned_by: 'dashboard',
      reason,
      status: 'open',
    })
    if (insErr) throw insErr

    // Ping the coordinator (no-op until the webhook URL is configured).
    const url = (process.env.N8N_WEBHOOK_NOTIFY_COORDINATOR ?? '').trim()
    let notified = false
    if (url) {
      const token = (process.env.N8N_WEBHOOK_TOKEN ?? '').trim()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'x-webhook-token': token } : {}) },
          body: JSON.stringify({
            coordinator,
            lead_id: l.id,
            patient: { name: l.nom, email: l.email, phone: l.numero_telephone },
            reason,
            source: 'dashboard',
            requested_at: new Date().toISOString(),
          }),
          signal: controller.signal,
        })
        notified = res.ok
      } catch {
        notified = false
      } finally {
        clearTimeout(timer)
      }
    }

    return NextResponse.json({ ok: true, coordinator, notified })
  } catch (err) {
    console.error('[nhs-patients/:id/assign]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
