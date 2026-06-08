import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'

// Open assignments grouped by coordinator — the shared "who's calling whom" view
// until per-coordinator logins exist. Each patient shows under their current
// (most recent) owner only, with an open_id that points at the dossier when one
// exists so the detail view opens with the full file.
export async function GET() {
  try {
    const sb = getSupabase()
    const { data: rows, error } = await sb
      .from('dashboard_assignments')
      .select('lead_id, assigned_to, reason, assigned_at, status')
      .in('status', ['open', 'pending'])
      .order('assigned_at', { ascending: false })
    if (error) throw error

    type Row = {
      lead_id: string | null
      assigned_to: string | null
      reason: string | null
      assigned_at: string | null
      status: string | null
    }
    const all = (rows ?? []) as Row[]

    // Keep the most recent open assignment per patient (current owner).
    const seen = new Set<string>()
    const current: Row[] = []
    for (const r of all) {
      if (!r.lead_id || seen.has(r.lead_id)) continue
      seen.add(r.lead_id)
      current.push(r)
    }

    const queues: Record<string, Array<{ lead_id: string; open_id: string; name: string | null }>> = {
      Summer: [],
      Rain: [],
      Stormi: [],
    }
    const leadIds = current.map(r => r.lead_id as string)
    if (leadIds.length === 0) return NextResponse.json({ queues })

    const [leadsRes, dossiersRes] = await Promise.all([
      sb.from('leads_rdv').select('id, nom').in('id', leadIds),
      sb.from('nhs_dossiers').select('id, lead_id').in('lead_id', leadIds),
    ])
    const nameById = new Map(
      ((leadsRes.data ?? []) as { id: string; nom: string | null }[]).map(l => [l.id, l.nom]),
    )
    const dossierByLead = new Map(
      ((dossiersRes.data ?? []) as { id: string; lead_id: string | null }[])
        .filter(d => d.lead_id != null)
        .map(d => [d.lead_id as string, d.id]),
    )

    for (const r of current) {
      const coord = r.assigned_to
      if (!coord || !(coord in queues)) continue
      const leadId = r.lead_id as string
      queues[coord].push({
        lead_id: leadId,
        open_id: dossierByLead.get(leadId) ?? leadId,
        name: nameById.get(leadId) ?? null,
      })
    }

    return NextResponse.json({ queues })
  } catch (err) {
    console.error('[nhs-assignments]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
