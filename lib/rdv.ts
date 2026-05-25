import type { CallLogEnriched } from './types'
import { leadGroupKey, agentLevel } from './lead-key'
import { qualKeyFromRaw, type QualKey } from './qualifications'

// ─── Strict RDV CONFIRME criteria (agreed with user) ────────────────────────
//
// A call qualifies RDV CONFIRME on its own when:
//   1. call_outcome === "consultation_booked"  (any duration), OR
//   2. call_outcome === "rdv_confirmed" | "rdv_confirme"  AND duration ≥ 60s
//
// A LEAD is RDV CONFIRME when one of its calls had:
//   3. transfer_to_isabelle === true AND duration ≥ 60s AND a later sibling
//      call by Isabelle (Agent 2) or Victoria (Agent 3) exists on the same
//      lead chain — proving the handoff actually completed.
//
// CRM value leads_rdv.qualification is NOT trusted for RDV CONFIRME. All
// other qualifications are derived from Retell signals first, with Supabase
// as a fallback only for non-RDV categories.

const POSITIVE_OUTCOMES_ANY_DURATION = new Set(['consultation_booked'])
const POSITIVE_OUTCOMES_NEED_60S = new Set(['rdv_confirmed', 'rdv_confirme'])

function normOutcome(c: CallLogEnriched): string {
  return (c.analysis?.callOutcome ?? '').toLowerCase().trim()
}

export function isCallRdvConfirmedAlone(c: CallLogEnriched): boolean {
  const o = normOutcome(c)
  if (POSITIVE_OUTCOMES_ANY_DURATION.has(o)) return true
  if (POSITIVE_OUTCOMES_NEED_60S.has(o) && c.duration >= 60) return true
  return false
}

function transferredAndContinued(
  myCall: CallLogEnriched,
  siblings: CallLogEnriched[]
): boolean {
  if (!myCall.analysis?.transferToIsabelle) return false
  if (myCall.duration < 60) return false
  const myT = new Date(myCall.startTime).getTime()
  if (!Number.isFinite(myT)) return false
  return siblings.some((s) => {
    if (s.callId === myCall.callId) return false
    const lvl = agentLevel(s.agentName)
    if (lvl !== 2 && lvl !== 3) return false
    const t = new Date(s.startTime).getTime()
    return Number.isFinite(t) && t > myT
  })
}

export function isLeadRdvConfirmed(siblings: CallLogEnriched[]): boolean {
  return siblings.some(
    (c) => isCallRdvConfirmedAlone(c) || transferredAndContinued(c, siblings)
  )
}

export function computeConfirmedRdvLeads(calls: CallLogEnriched[]): Set<string> {
  const byLead = new Map<string, CallLogEnriched[]>()
  for (const c of calls) {
    const k = leadGroupKey(c)
    if (!k) continue
    if (!byLead.has(k)) byLead.set(k, [])
    byLead.get(k)!.push(c)
  }
  const out = new Set<string>()
  for (const [k, list] of byLead.entries()) {
    if (isLeadRdvConfirmed(list)) out.add(k)
  }
  return out
}

// ─── Call_outcome → QualKey mapping (Retell signals) ────────────────────────
//
// These are the values n8n/Retell AI writes into
// call_analysis.custom_analysis_data.call_outcome. We normalise to lowercase.
// RDV-family values are intentionally listed here but overridden by the strict
// check above so they never reach this map unless the strict check passed.

const OUTCOME_TO_QUAL: Record<string, QualKey> = {
  // À passer à l'humain
  'a_passer_a_humain': 'a_passer_a_humain',
  "à passer à l'humain": 'a_passer_a_humain',
  'transferred_to_isabelle': 'a_passer_a_humain',
  'human_handoff': 'a_passer_a_humain',
  'human_transfer': 'a_passer_a_humain',
  'transfert_humain': 'a_passer_a_humain',

  // Rappel
  'rappel': 'rappel',
  'callback_scheduled': 'rappel',
  'follow_up': 'rappel',
  'follow up': 'rappel',

  // Pas intéressé
  'pas_interesse': 'pas_interesse',
  'pas intéressé': 'pas_interesse',
  'not_interested': 'pas_interesse',

  // Pas de réponse
  'pas_de_reponse': 'pas_de_reponse',
  'pas de réponse': 'pas_de_reponse',
  'no_answer': 'pas_de_reponse',
  'no answer': 'pas_de_reponse',
  'nouveau_dossier': 'pas_de_reponse',
  'nouveau dossier': 'pas_de_reponse',

  // Répondeur
  'repondeur': 'repondeur',
  'répondeur': 'repondeur',
  'voicemail': 'repondeur',
  'in_voicemail': 'repondeur',

  // Faux numéro
  'faux_numero': 'faux_numero',
  'faux numéro': 'faux_numero',
  'wrong_number': 'faux_numero',

  // Non éligible
  'non_eligible': 'non_eligible',
  'non éligible': 'non_eligible',
  'not_eligible': 'non_eligible',
  'ineligible': 'non_eligible',

  // Ne pas rappeler
  'ne_pas_rappeler': 'ne_pas_rappeler',
  'ne pas rappeler': 'ne_pas_rappeler',
  'do_not_call': 'ne_pas_rappeler',
  'dnc': 'ne_pas_rappeler',
}

const EMPTY_SET = new Set<string>()

// ─── Per-call effective qualification ────────────────────────────────────────
//
// Priority order:
//  1. Strict per-call RDV CONFIRME signal
//  2. Lead-level RDV CONFIRME (requires confirmedRdvLeadKeys pre-computed)
//  3. Voicemail signals (override everything else below)
//  4. Human handoff signals
//  5. call_outcome direct mapping
//  6. Supabase leads_rdv.qualification (fallback, never trusted for RDV)
//  7. Intelligent re-route when CRM says RDV but strict check failed
//  8. Default → pas_de_reponse

export function effectiveQualKey(
  c: CallLogEnriched,
  confirmedRdvLeadKeys: Set<string> = EMPTY_SET
): QualKey {
  // 1 & 2 — Strict RDV CONFIRME
  if (isCallRdvConfirmedAlone(c)) return 'rdv_confirme'
  const lk = leadGroupKey(c)
  if (lk && confirmedRdvLeadKeys.has(lk)) return 'rdv_confirme'

  // 3 — Voicemail (strongest non-RDV signal)
  if (c.inVoicemail || c.voicemailSuspected) return 'repondeur'

  // 4 — Human handoff intent (transfer fired but strict RDV not met)
  if (c.analysis?.humanTransferTriggered || c.analysis?.transferToIsabelle) {
    return 'a_passer_a_humain'
  }

  // 5 — Retell call_outcome direct map
  const outcome = normOutcome(c)
  const fromOutcome = OUTCOME_TO_QUAL[outcome]
  if (fromOutcome) return fromOutcome

  // 6 — Supabase fallback (never trust rdv_confirme here alone)
  const fromCRM = qualKeyFromRaw(c.lead?.qualification)
  if (fromCRM !== 'rdv_confirme') return fromCRM

  // 7 — CRM says RDV but strict criteria not met → intelligent reroute
  if (!c.answered || c.duration < 20) return 'pas_de_reponse'
  if (c.analysis?.transferToIsabelle) return 'a_passer_a_humain'
  return 'pas_de_reponse'
}
