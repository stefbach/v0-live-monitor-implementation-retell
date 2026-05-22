import type { CallLogEnriched, Lead } from './types'
import { qualKeyFromRaw, type QualKey } from './qualifications'
import { effectiveQualKey } from './rdv'
import { leadGroupKey, hasMetadata, agentLevel } from './lead-key'

// Re-export for backwards compatibility with existing imports
export { leadGroupKey, hasMetadata, agentLevel }

// ─── KPI banner ─────────────────────────────────────────────────────────────

export interface DirectorKpis {
  totalCalls: number
  answered: number
  answeredPct: number
  cost: number // cents
  rdvConfirmed: number // distinct leads with qualification = RDV CONFIRME
  conversionRate: number // rdv / answered (%)
  avgDuration: number // seconds (TMMC)
  callbacks: number // calls with callback scheduled
  callsOverThreshold: number // calls with duration > threshold seconds
}

export function computeDirectorKpis(
  calls: CallLogEnriched[],
  durationThresholdSec: number
): DirectorKpis {
  const total = calls.length
  let answered = 0
  let cost = 0
  let duration = 0
  let callbacks = 0
  let over = 0

  const rdvLeads = new Set<string>()
  for (const c of calls) {
    if (c.answered) answered++
    cost += c.cost ?? 0
    duration += c.duration
    if (c.analysis?.callbackScheduled) callbacks++
    if (c.duration > durationThresholdSec) over++
    if (effectiveQualKey(c) === 'rdv_confirme') {
      const k = leadGroupKey(c)
      if (k) rdvLeads.add(k)
    }
  }

  const rdv = rdvLeads.size
  return {
    totalCalls: total,
    answered,
    answeredPct: total > 0 ? (answered / total) * 100 : 0,
    cost,
    rdvConfirmed: rdv,
    conversionRate: answered > 0 ? (rdv / answered) * 100 : 0,
    avgDuration: total > 0 ? duration / total : 0,
    callbacks,
    callsOverThreshold: over,
  }
}

// Which calls back a given KPI (for the click-through slide-over)
export type KpiId =
  | 'total'
  | 'answered'
  | 'cost'
  | 'rdv'
  | 'conversion'
  | 'avg'
  | 'callbacks'
  | 'over'

export function callsForKpi(
  calls: CallLogEnriched[],
  kpi: KpiId,
  thresholdSec: number
): CallLogEnriched[] {
  switch (kpi) {
    case 'answered':
      return calls.filter((c) => c.answered)
    case 'rdv':
    case 'conversion':
      return calls.filter((c) => effectiveQualKey(c) === 'rdv_confirme')
    case 'callbacks':
      return calls.filter((c) => c.analysis?.callbackScheduled)
    case 'over':
      return calls.filter((c) => c.duration > thresholdSec)
    case 'cost':
      return [...calls].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
    case 'avg':
    case 'total':
    default:
      return calls
  }
}

// ─── Qualification counts ───────────────────────────────────────────────────

export interface QualCount {
  key: QualKey
  count: number
}

// Counts CALLS (not distinct leads) by Supabase qualification. Every
// call lives in exactly one card — Σ counts = calls.length — because
// qualKeyFromRaw routes unknown / missing values to 'pas_de_reponse'.
export function computeQualificationCounts(
  calls: CallLogEnriched[]
): Record<QualKey, number> {
  const counts: Record<QualKey, number> = {
    rdv_confirme: 0,
    a_passer_a_humain: 0,
    rappel: 0,
    pas_interesse: 0,
    pas_de_reponse: 0,
    repondeur: 0,
    faux_numero: 0,
    non_eligible: 0,
    ne_pas_rappeler: 0,
  }
  for (const c of calls) counts[effectiveQualKey(c)]++
  return counts
}

export function callsForQualification(
  calls: CallLogEnriched[],
  key: QualKey
): CallLogEnriched[] {
  return calls.filter((c) => effectiveQualKey(c) === key)
}

// ─── Phase J1 / J3 / J5 tracking ────────────────────────────────────────────

export interface PhaseTracking {
  phases: { phase: string; leads: number; calls: number }[]
  creneaux: { key: string; label: string; calls: number }[]
}

const CRENEAU_LABEL: Record<string, string> = {
  creneau_1: 'Créneau 1 — matin',
  creneau_2: 'Créneau 2 — midi',
  creneau_3: 'Créneau 3 — soir',
  hors_creneau: 'Hors créneau',
}

export function computePhaseTracking(calls: CallLogEnriched[]): PhaseTracking {
  const phaseMap = new Map<string, { leads: Set<string>; calls: number }>()
  const creneauMap = new Map<string, number>()
  for (const c of calls) {
    const phase = c.meta?.phase ?? 'Inconnu'
    const b = phaseMap.get(phase) ?? { leads: new Set<string>(), calls: 0 }
    b.calls++
    const lid = leadGroupKey(c)
    if (lid) b.leads.add(lid)
    phaseMap.set(phase, b)
    creneauMap.set(c.creneau, (creneauMap.get(c.creneau) ?? 0) + 1)
  }
  const order = ['J1', 'J3', 'J5', 'Inconnu']
  const phases = [...phaseMap.entries()]
    .map(([phase, v]) => ({ phase, leads: v.leads.size, calls: v.calls }))
    .sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase))
  const creneaux = ['creneau_1', 'creneau_2', 'creneau_3', 'hors_creneau'].map((k) => ({
    key: k,
    label: CRENEAU_LABEL[k],
    calls: creneauMap.get(k) ?? 0,
  }))
  return { phases, creneaux }
}

// ─── Agent chain buckets (Agent 1 only / 1+2 / 1+2+3) ───────────────────────

export interface AgentBuckets {
  agent1Only: number
  agent1And2: number
  agent1And2And3: number
}

const leadKey = leadGroupKey

export function computeAgentBuckets(calls: CallLogEnriched[]): AgentBuckets {
  const byLead = new Map<string, Set<number>>()
  for (const c of calls) {
    const k = leadKey(c)
    if (!k) continue
    const lvl = agentLevel(c.agentName)
    if (!lvl) continue
    if (!byLead.has(k)) byLead.set(k, new Set())
    byLead.get(k)!.add(lvl)
  }
  let a1 = 0
  let a12 = 0
  let a123 = 0
  for (const levels of byLead.values()) {
    const max = Math.max(...levels)
    if (max >= 3) a123++
    else if (max === 2) a12++
    else if (max === 1) a1++
  }
  return { agent1Only: a1, agent1And2: a12, agent1And2And3: a123 }
}

export function callsForAgentBucket(
  calls: CallLogEnriched[],
  bucket: 'a1' | 'a12' | 'a123'
): CallLogEnriched[] {
  const byLead = new Map<string, Set<number>>()
  for (const c of calls) {
    const k = leadKey(c)
    if (!k) continue
    const lvl = agentLevel(c.agentName)
    if (!lvl) continue
    if (!byLead.has(k)) byLead.set(k, new Set())
    byLead.get(k)!.add(lvl)
  }
  const targetMax = bucket === 'a1' ? 1 : bucket === 'a12' ? 2 : 3
  const leadIds = new Set<string>()
  for (const [k, levels] of byLead.entries()) {
    if (Math.max(...levels) === targetMax) leadIds.add(k)
  }
  return calls.filter((c) => {
    const k = leadKey(c)
    return k != null && leadIds.has(k)
  })
}

// ─── Dossiers à confier à un humain ─────────────────────────────────────────
//
// Pure Supabase view: a candidate is any lead whose qualification is
// "À PASSER À L'HUMAIN". No Retell-derived signals, no duration filter
// — the source of truth is the CRM tag set by n8n / the team.

export interface HandoffCandidate {
  leadId: string
  name: string | null
  phone: string | null
  email: string | null
  reasons: string[]
  bmi: number | null
  source: string | null
  qualification: string | null
  lastCall: string
  attempts: number
}

export function computeHandoffCandidates(
  calls: CallLogEnriched[],
  _leads: Lead[]
): HandoffCandidate[] {
  const byLead = new Map<string, CallLogEnriched[]>()
  for (const c of calls) {
    if (qualKeyFromRaw(c.lead?.qualification) !== 'a_passer_a_humain') continue
    const k = leadKey(c)
    if (!k) continue
    if (!byLead.has(k)) byLead.set(k, [])
    byLead.get(k)!.push(c)
  }

  const out: HandoffCandidate[] = []
  for (const [k, list] of byLead.entries()) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
    const latest = sorted[0]
    const lead = latest.lead
    out.push({
      leadId: lead?.id ?? k,
      name: lead?.nom ?? null,
      phone: lead?.numero_telephone ?? latest.toNumber ?? null,
      email: lead?.email ?? null,
      reasons: ['Tag CRM : À passer à l\'humain'],
      bmi: lead?.bmi ?? null,
      source: lead?.source_lead ?? null,
      qualification: lead?.qualification ?? null,
      lastCall: latest.startTime,
      attempts: list.length,
    })
  }
  return out.sort(
    (a, b) => new Date(b.lastCall).getTime() - new Date(a.lastCall).getTime()
  )
}
