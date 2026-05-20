import type { CallLogEnriched, Lead } from './types'
import { qualKeyFromRaw, type QualKey } from './qualifications'
import { computeEligibility } from './eligibility'
import { computeConfirmedRdvLeads } from './rdv'
import { leadGroupKey, hasMetadata, agentLevel } from './lead-key'

// Re-export for backwards compatibility with existing imports
export { leadGroupKey, hasMetadata, agentLevel }

// ─── KPI banner ─────────────────────────────────────────────────────────────

export interface DirectorKpis {
  totalCalls: number
  answered: number
  answeredPct: number
  cost: number // cents
  rdvConfirmed: number // distinct leads with qualification → rdv_confirme
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

  for (const c of calls) {
    if (c.answered) answered++
    cost += c.cost ?? 0
    duration += c.duration
    if (c.analysis?.callbackScheduled) callbacks++
    if (c.duration > durationThresholdSec) over++
  }

  // Strict RDV CONFIRMÉ: re-derived from call-level evidence (#1).
  // Don't trust leads_rdv.qualification === 'RDV MEDECIN' for 3-second calls.
  const rdvLeadIds = computeConfirmedRdvLeads(calls)

  const rdv = rdvLeadIds.size
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
    case 'conversion': {
      const confirmed = computeConfirmedRdvLeads(calls)
      return calls.filter((c) => {
        const k = leadGroupKey(c)
        return !!k && confirmed.has(k)
      })
    }
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

// ─── Qualification counts (lead-level = source of truth) ────────────────────

export interface QualCount {
  key: QualKey
  count: number
}

// Counts DISTINCT leads (by lead id) among the given calls, by qualification.
// NON ELIGIBLE is computed from BMI (S2) and overrides only for leads that
// are otherwise still "open" (not already RDV / not interested / faux numéro).
export function computeQualificationCounts(
  calls: CallLogEnriched[]
): Record<QualKey, number> {
  const seen = new Map<string, CallLogEnriched>()
  for (const c of calls) {
    const id = leadGroupKey(c)
    if (!id) continue
    // keep the most recent call per lead
    const prev = seen.get(id)
    if (!prev || new Date(c.startTime).getTime() > new Date(prev.startTime).getTime()) {
      seen.set(id, c)
    }
  }
  const counts: Record<QualKey, number> = {
    rdv_confirme: 0,
    rdv_non_confirme: 0,
    rappel: 0,
    pas_interesse: 0,
    pas_de_reponse: 0,
    faux_numero: 0,
    nouveau_dossier: 0,
    non_eligible: 0,
    ne_pas_rappeler: 0,
    autre: 0,
  }
  const confirmedRdv = computeConfirmedRdvLeads(calls)
  for (const [id, c] of seen.entries()) {
    let key = qualKeyFromRaw(c.lead?.qualification)
    // Strict RDV CONFIRMÉ override (#1): if CRM says RDV MEDECIN but the
    // lead's calls don't satisfy the criteria, route to 'autre' so the
    // RDV CONFIRME card stays trustworthy.
    if (key === 'rdv_confirme' && !confirmedRdv.has(id)) {
      counts.autre++
      continue
    }
    // NON ELIGIBLE overlay: only for still-open leads
    if (
      (key === 'nouveau_dossier' || key === 'pas_de_reponse' || key === 'rappel') &&
      c.lead
    ) {
      const elig = computeEligibility({
        bmi: c.lead.bmi,
        nhs_wmp_status: null,
        nhs_wmp_details: null,
        other_chronic_conditions: null,
        current_medications: null,
        note: null,
        allergies: null,
      })
      if (elig.reason === 'bmi_below') {
        counts.non_eligible++
        continue
      }
    }
    counts[key]++
  }
  return counts
}

export function callsForQualification(
  calls: CallLogEnriched[],
  key: QualKey
): CallLogEnriched[] {
  if (key === 'non_eligible') {
    return calls.filter((c) => {
      if (!c.lead) return false
      const e = computeEligibility({
        bmi: c.lead.bmi,
        nhs_wmp_status: null,
        nhs_wmp_details: null,
        other_chronic_conditions: null,
        current_medications: null,
        note: null,
        allergies: null,
      })
      return e.reason === 'bmi_below'
    })
  }
  if (key === 'rdv_confirme') {
    // Strict (#1): only the leads passing the call-level criteria
    const confirmed = computeConfirmedRdvLeads(calls)
    return calls.filter((c) => {
      const k = leadGroupKey(c)
      return !!k && confirmed.has(k)
    })
  }
  if (key === 'autre') {
    // Raw 'autre' + CRM-RDV leads that failed the strict criteria
    const confirmed = computeConfirmedRdvLeads(calls)
    return calls.filter((c) => {
      const raw = qualKeyFromRaw(c.lead?.qualification)
      if (raw === 'autre') return true
      if (raw === 'rdv_confirme') {
        const k = leadGroupKey(c)
        return !k || !confirmed.has(k)
      }
      return false
    })
  }
  return calls.filter((c) => qualKeyFromRaw(c.lead?.qualification) === key)
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

// agentLevel + leadGroupKey moved to lib/lead-key.ts to avoid a circular
// import with lib/rdv.ts. Re-exported above for backward compatibility.

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

// Difficult leads: eligible but not converted, robot-awareness detected,
// or several failed attempts without reaching the prospect.
export function computeHandoffCandidates(
  calls: CallLogEnriched[],
  leads: Lead[]
): HandoffCandidate[] {
  const leadById = new Map(leads.map((l) => [l.id, l]))
  const byLead = new Map<string, CallLogEnriched[]>()
  for (const c of calls) {
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
    const fullLead = leadById.get(lead?.id ?? '') ?? null
    const reasons: string[] = []

    const qual = qualKeyFromRaw(lead?.qualification)
    const elig = lead
      ? computeEligibility({
          bmi: lead.bmi,
          nhs_wmp_status: fullLead?.nhs_wmp_status ?? null,
          nhs_wmp_details: fullLead?.nhs_wmp_details ?? null,
          other_chronic_conditions: fullLead?.other_chronic_conditions ?? null,
          current_medications: fullLead?.current_medications ?? null,
          note: fullLead?.note ?? null,
          allergies: fullLead?.allergies ?? null,
        })
      : null

    if (elig?.eligible && qual !== 'rdv_confirme' && qual !== 'pas_interesse') {
      reasons.push('Éligible mais pas allé au bout')
    }
    if (list.some((c) => c.robotAwareness === true)) {
      reasons.push('Robot awareness détecté')
    }
    const failed = list.filter((c) => !c.answered).length
    if (failed >= 3 && qual !== 'rdv_confirme') {
      reasons.push(`${failed} tentatives sans réponse`)
    }
    if (list.some((c) => c.analysis?.humanTransferTriggered)) {
      reasons.push('Transfert humain déclenché')
    }

    if (reasons.length === 0) continue
    out.push({
      leadId: lead?.id ?? k,
      name: lead?.nom ?? null,
      phone: lead?.numero_telephone ?? latest.toNumber ?? null,
      email: lead?.email ?? null,
      reasons,
      bmi: lead?.bmi ?? null,
      source: lead?.source_lead ?? null,
      qualification: lead?.qualification ?? null,
      lastCall: latest.startTime,
      attempts: list.length,
    })
  }
  return out.sort((a, b) => b.reasons.length - a.reasons.length)
}
