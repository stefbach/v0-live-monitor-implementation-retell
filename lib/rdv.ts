import type { CallLogEnriched } from './types'
import { leadGroupKey, agentLevel } from './lead-key'
import { qualKeyFromRaw, type QualKey } from './qualifications'

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

// Per-call effective qualification: if CRM says RDV MEDECIN but the lead
// does not satisfy the strict criteria, surface "rdv_non_confirme" so the
// UI doesn't show "RDV CONFIRME" badges on 3-second calls.
export function effectiveQualKey(
  c: CallLogEnriched,
  confirmedRdvLeadKeys: Set<string>
): QualKey {
  const raw = qualKeyFromRaw(c.lead?.qualification)
  if (raw !== 'rdv_confirme') return raw
  const k = leadGroupKey(c)
  if (!k || !confirmedRdvLeadKeys.has(k)) return 'rdv_non_confirme'
  return 'rdv_confirme'
}
