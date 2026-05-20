import type { CallLogEnriched } from './types'
import { leadGroupKey, agentLevel } from './lead-key'
import { qualKeyFromRaw, type QualKey } from './qualifications'
import { computeEligibility } from './eligibility'

// Strict definition of "RDV confirmé", agreed with the user (#1).
//
// A call qualifies as RDV confirmé on its own if:
//   - custom_analysis_data.call_outcome === "consultation_booked"
//     (regardless of duration), OR
//   - call_outcome === "rdv_confirmed" (or "rdv_confirme") AND duration ≥ 60s
//
// In addition, a LEAD is RDV confirmé when one of its earlier calls had
// transfer_to_isabelle === true AND duration ≥ 60s AND a later sibling
// call exists on the same lead with an Isabelle (Agent 2) or Victoria
// (Agent 3) — proving the handoff actually went through.
//
// The intent: never count 3-second "RDV MEDECIN" calls. The CRM state in
// leads_rdv.qualification is treated as approximate; we re-derive the
// truth from call-level evidence.

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

// True if this call triggered a transfer AND a later sibling reached
// Isabelle/Victoria — the lead's RDV is then considered confirmé.
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

// Returns the Set of leadGroupKey() values whose calls satisfy the strict
// RDV criteria across the provided call list.
export function computeConfirmedRdvLeads(
  calls: CallLogEnriched[]
): Set<string> {
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

// Single source of truth for the FINAL bucket of any call. Used by:
//   - card counters (computeQualificationCounts)
//   - slide-over filtering (callsForQualification)
//   - per-row badges (CallLogsTable, DetailSlideOver, CallDetailSheet…)
// so the UI is internally consistent.
//
// Routing rules (in order):
//   1) RDV CONFIRMÉ → strict criteria of computeConfirmedRdvLeads; else
//      re-routed to RAPPEL (needs follow-up to actually confirm).
//   2) NOUVEAU DOSSIER (CRM default) or unmapped → infer from call signal:
//        - c.answered (real conversation > 15s, valid disconnect) → RAPPEL
//        - voicemail (c.inVoicemail OR voicemailSuspected)        → REPONDEUR
//        - otherwise (true no-answer)                             → PAS DE REPONSE
//   3) NON ELIGIBLE overlay: ONLY when the call was actually answered
//      AND the lead's BMI is below the S2 threshold. Applies on top of
//      the "still-open" buckets only (rappel / repondeur / pas_de_reponse),
//      never overrides explicit refusals (pas_interesse / faux_numero /
//      ne_pas_rappeler) nor confirmed RDV.
export function effectiveQualKey(
  c: CallLogEnriched,
  confirmedRdvLeadKeys: Set<string>
): QualKey {
  let key = qualKeyFromRaw(c.lead?.qualification)

  // 1) Strict RDV CONFIRMÉ
  if (key === 'rdv_confirme') {
    const lk = leadGroupKey(c)
    if (!lk || !confirmedRdvLeadKeys.has(lk)) key = 'rappel'
  }

  // 2) NOUVEAU DOSSIER / unmapped → re-route by call signal
  if (key === 'nouveau_dossier' || key === 'autre') {
    if (c.answered) key = 'rappel'
    else if (c.inVoicemail || c.voicemailSuspected) key = 'repondeur'
    else key = 'pas_de_reponse'
  }

  // 3) NON ELIGIBLE overlay — only if we actually spoke to the person
  if (
    c.answered &&
    c.lead &&
    (key === 'rappel' || key === 'repondeur' || key === 'pas_de_reponse')
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
    if (elig.reason === 'bmi_below') return 'non_eligible'
  }

  return key
}
