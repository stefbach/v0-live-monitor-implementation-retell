import { getSupabaseServer } from './supabase'
import { normalizePhone } from './phone'
import type {
  Lead,
  LeadSummary,
  BusinessMetrics,
  QualificationBreakdown,
  SourceBreakdown,
  AgentPerformance,
  ConversionFunnel,
  Qualification,
} from './types'

const NEGATIVE_QUALIFS: Qualification[] = ['PAS INTERESSE', 'FAUX NUMERO']
const RDV_QUALIF: Qualification = 'RDV MEDECIN'

// ─── DB fetch ───────────────────────────────────────────────────────────────

export async function fetchAllLeads(): Promise<Lead[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase.from('leads_rdv').select('*').limit(10000)

  if (error || !data) return []

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      nom: (r.nom as string) ?? null,
      email: (r.email as string) ?? null,
      numero_telephone: (r.numero_telephone as string) ?? null,
      poids: toNumber(r.poids),
      taille: toNumber(r.taille),
      bmi: toNumber(r.bmi),
      source_lead: (r.source_lead as string) ?? null,
      form_facebook: (r.form_facebook as string) ?? null,
      agent: (r.agent as string) ?? null,
      date_rdv: (r.date_rdv as string) ?? null,
      date_creation: (r.date_creation as string) ?? null,
      qualification: (r.qualification as Qualification) ?? null,
      note: (r.note as string) ?? null,
      rappel_rdv: (r.rappel_rdv as string) ?? null,
      call_count: toNumber(r.call_count),
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
      whatsapp_sent: (r.whatsapp_sent as boolean) ?? null,
      last_call_datetime: (r.last_call_datetime as string) ?? null,
      call_1_note: (r.call_1_note as string) ?? null,
      call_2_note: (r.call_2_note as string) ?? null,
      call_3_note: (r.call_3_note as string) ?? null,
    }
  })
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// ─── Phone-indexed map for fast Retell-call → Lead lookup ───────────────────

export function indexLeadsByPhone(leads: Lead[]): Map<string, Lead> {
  const map = new Map<string, Lead>()
  for (const l of leads) {
    const key = normalizePhone(l.numero_telephone)
    if (!key) continue
    // Keep the most recently updated lead per phone
    const prev = map.get(key)
    if (!prev) {
      map.set(key, l)
      continue
    }
    const prevTs = leadTimestamp(prev)
    const curTs = leadTimestamp(l)
    if (curTs > prevTs) map.set(key, l)
  }
  return map
}

function leadTimestamp(l: Lead): number {
  const candidates = [
    l.last_call_datetime,
    l.last_qualification_update,
    l.date_creation,
  ]
  for (const c of candidates) {
    if (c) {
      const t = new Date(c).getTime()
      if (Number.isFinite(t)) return t
    }
  }
  return 0
}

export function toLeadSummary(l: Lead): LeadSummary {
  return {
    id: l.id,
    nom: l.nom,
    email: l.email,
    numero_telephone: l.numero_telephone,
    bmi: l.bmi,
    poids: l.poids,
    taille: l.taille,
    patient_dob: l.patient_dob,
    qualification: l.qualification,
    source_lead: l.source_lead,
    call_count: l.call_count,
    date_rdv: l.date_rdv,
    rappel_rdv: l.rappel_rdv,
    last_call_datetime: l.last_call_datetime,
    email_sent: l.email_sent,
    whatsapp_sent: l.whatsapp_sent,
  }
}

// ─── Business metrics aggregation ───────────────────────────────────────────

export function computeBusinessMetrics(
  leads: Lead[],
  agentNames: Record<string, string>,
  callsByAgent: Map<string, { calls: number; duration: number; cost: number }>
): BusinessMetrics {
  const totalLeads = leads.length

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000

  let newLeadsToday = 0
  let rdvToday = 0
  let rdvThisWeek = 0
  const qualCounts = new Map<Qualification, number>()
  const sourceMap = new Map<string, { total: number; rdv: number }>()
  let contacted = 0
  let interested = 0
  let rdvBooked = 0
  let totalCallsForRdv = 0
  let leadsWithRdv = 0

  for (const l of leads) {
    if (l.date_creation) {
      const t = new Date(l.date_creation).getTime()
      if (t >= startOfToday) newLeadsToday++
    }
    if (l.date_rdv) {
      const t = new Date(l.date_rdv).getTime()
      if (t >= startOfToday) rdvToday++
      if (t >= startOfWeek) rdvThisWeek++
    }
    const q = (l.qualification ?? 'NOUVEAU DOSSIER') as Qualification
    qualCounts.set(q, (qualCounts.get(q) ?? 0) + 1)
    const src = l.source_lead?.trim() || 'Unknown'
    const sBucket = sourceMap.get(src) ?? { total: 0, rdv: 0 }
    sBucket.total++
    if (q === RDV_QUALIF) sBucket.rdv++
    sourceMap.set(src, sBucket)

    if ((l.call_count ?? 0) > 0 || q !== 'NOUVEAU DOSSIER') contacted++
    if (!NEGATIVE_QUALIFS.includes(q) && q !== 'NOUVEAU DOSSIER') interested++
    if (q === RDV_QUALIF) {
      rdvBooked++
      if ((l.call_count ?? 0) > 0) {
        totalCallsForRdv += l.call_count ?? 0
        leadsWithRdv++
      }
    }
  }

  const qualifications: QualificationBreakdown[] = [...qualCounts.entries()]
    .map(([qualification, count]) => ({
      qualification,
      count,
      percent: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const sources: SourceBreakdown[] = [...sourceMap.entries()]
    .map(([source, v]) => ({
      source,
      total: v.total,
      rdv: v.rdv,
      conversionRate: v.total > 0 ? (v.rdv / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Per-agent: count RDV via the lead's `agent` field, but call volume + cost
  // come from Retell (via callsByAgent map).
  const rdvByAgent = new Map<string, number>()
  for (const l of leads) {
    if (l.qualification === RDV_QUALIF && l.agent) {
      rdvByAgent.set(l.agent, (rdvByAgent.get(l.agent) ?? 0) + 1)
    }
  }
  const agentIds = new Set<string>([
    ...rdvByAgent.keys(),
    ...callsByAgent.keys(),
    ...Object.keys(agentNames),
  ])
  const agents: AgentPerformance[] = [...agentIds]
    .map((id) => {
      const callStats = callsByAgent.get(id) ?? { calls: 0, duration: 0, cost: 0 }
      const rdv = rdvByAgent.get(id) ?? 0
      return {
        agentId: id,
        agentName: agentNames[id] || id.slice(0, 8),
        calls: callStats.calls,
        rdv,
        rdvRate: callStats.calls > 0 ? (rdv / callStats.calls) * 100 : 0,
        avgDuration:
          callStats.calls > 0 ? Math.round(callStats.duration / callStats.calls) : 0,
        totalCost: callStats.cost,
      }
    })
    .filter((a) => a.calls > 0 || a.rdv > 0)
    .sort((a, b) => b.rdv - a.rdv || b.calls - a.calls)

  const funnel: ConversionFunnel = {
    leads: totalLeads,
    contacted,
    interested,
    rdvBooked,
    contactRate: totalLeads > 0 ? (contacted / totalLeads) * 100 : 0,
    interestRate: contacted > 0 ? (interested / contacted) * 100 : 0,
    bookingRate: contacted > 0 ? (rdvBooked / contacted) * 100 : 0,
  }

  return {
    totalLeads,
    newLeadsToday,
    rdvThisWeek,
    rdvToday,
    rdvRate: funnel.bookingRate,
    contactRate: funnel.contactRate,
    avgCallsBeforeRdv: leadsWithRdv > 0 ? totalCallsForRdv / leadsWithRdv : 0,
    qualifications,
    sources,
    agents,
    funnel,
  }
}
