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

// Final bucket for any call. Used by card counters, slide-over filters
// and per-row badges so the UI stays internally consistent.
//
// Source of truth = leads_rdv.qualification (Supabase). The only piece
// of Retell-derived logic kept is the strict RDV CONFIRMÉ check (#1):
// a lead the CRM marks "RDV MEDECIN" but whose calls don't satisfy
// the criteria of computeConfirmedRdvLeads (consultation_booked /
// rdv_confirmed ≥60s / handoff to Isabelle ≥60s + reached Victoria) is
// downgraded to 'rdv_non_confirme' so the RDV CONFIRMÉ card doesn't
// inflate on short calls.
//
// All other cards (RAPPEL, NON ELIGIBLE, NE PAS RAPPELER, REPONDEUR,
// PAS DE REPONSE, PAS INTERESSE, FAUX NUMERO, NOUVEAU DOSSIER) read
// leads_rdv.qualification directly. No NOUVEAU DOSSIER inferred
// routing, no BMI overlay, no callback_scheduled / call_outcome
// overrides — n8n Agent 2 is now responsible for proper classification
// in Supabase.
// Quals where the prospect has actively decided ("not interested", "wrong
// number", "do not call") or where we've already confirmed an RDV. These
// are NEVER overridden by the handoff overlay — the lead has a clear
// terminal state already.
const HANDOFF_PROTECTED: Set<QualKey> = new Set([
  'rdv_confirme',
  'pas_interesse',
  'faux_numero',
  'ne_pas_rappeler',
])

export function effectiveQualKey(
  c: CallLogEnriched,
  confirmedRdvLeadKeys: Set<string>,
  handoffLeadKeys?: Set<string>
): QualKey {
  const key = qualKeyFromRaw(c.lead?.qualification)
  if (key === 'rdv_confirme') {
    const lk = leadGroupKey(c)
    if (!lk || !confirmedRdvLeadKeys.has(lk)) {
      // Downgraded RDV: still eligible for handoff overlay below.
      const downgraded: QualKey = 'rdv_non_confirme'
      if (handoffLeadKeys && lk && handoffLeadKeys.has(lk)) {
        return 'a_passer_a_humain'
      }
      return downgraded
    }
    return key
  }
  // Handoff overlay: a lead flagged for human handoff (and not in a
  // protected terminal state) shows as À PASSER À L'HUMAIN everywhere.
  if (handoffLeadKeys && !HANDOFF_PROTECTED.has(key)) {
    const lk = leadGroupKey(c)
    if (lk && handoffLeadKeys.has(lk)) return 'a_passer_a_humain'
  }
  return key
}
