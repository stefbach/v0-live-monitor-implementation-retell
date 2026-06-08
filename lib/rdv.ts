import type { CallLogEnriched } from './types'
import { leadGroupKey, agentLevel } from './lead-key'
import { qualKeyFromRaw, type QualKey } from './qualifications'

// ─── Strict RDV CONFIRME criteria (agreed with user) ────────────────────────
//
// A call qualifies RDV CONFIRME on its own when:
//   - call_outcome is a positive booking signal (consultation_booked,
//     rdv_confirmed, rdv_confirme) AND the call lasted MORE THAN 5 minutes.
//     A real booking conversation takes time; a positive outcome on a short
//     call is not trusted.
//
// A LEAD is RDV CONFIRME when one of its calls had:
//   - transfer_to_isabelle === true AND the transferring call lasted > 5 min
//     AND a later sibling call by Isabelle (Agent 2) or Victoria (Agent 3)
//     exists on the same lead chain — proving the handoff actually completed.
//
// CRM value leads_rdv.qualification is NOT trusted for RDV CONFIRME. All
// other qualifications are derived from Retell signals first, with Supabase
// as a fallback only for non-RDV categories.

// A genuine RDV booking conversation lasts more than 5 minutes. Below this,
// even a positive call_outcome is treated as not-yet-confirmed.
const RDV_MIN_DURATION_SECONDS = 300

const RDV_POSITIVE_OUTCOMES = new Set([
  'consultation_booked',
  'rdv_confirmed',
  'rdv_confirme',
])

function normOutcome(c: CallLogEnriched): string {
  return (c.analysis?.callOutcome ?? '').toLowerCase().trim()
}

export function isCallRdvConfirmedAlone(c: CallLogEnriched): boolean {
  if (c.duration <= RDV_MIN_DURATION_SECONDS) return false
  return RDV_POSITIVE_OUTCOMES.has(normOutcome(c))
}

function transferredAndContinued(
  myCall: CallLogEnriched,
  siblings: CallLogEnriched[]
): boolean {
  if (!myCall.analysis?.transferToIsabelle) return false
  if (myCall.duration <= RDV_MIN_DURATION_SECONDS) return false
  const myT = new Date(myCall.startTime).getTime()
  if (!Number.isFinite(myT)) return false
  return siblings.some((s) => {
    if (s.callId === myCall.callId) return false
    const lvl = agentLevel(s.agentId, s.agentName)
    if (lvl !== 2 && lvl !== 3) return false
    const t = new Date(s.startTime).getTime()
    return Number.isFinite(t) && t > myT
  })
}

// Confirmation pack (email + whatsapp) sent on the lead. NOT sufficient alone —
// n8n also sends these for outreach/relance to leads who never answered — so it
// must be paired with proof of a real answered conversation.
function callHasConfirmationPack(c: CallLogEnriched): boolean {
  return c.lead?.email_sent === true && c.lead?.whatsapp_sent === true
}

// At least one of email_sent / whatsapp_sent is true. Used as a softer signal
// when the CRM qualification already says RDV — covers the case where one of
// the two n8n send-nodes failed (e.g. WATI 4xx) but the lead is genuinely a
// confirmed RDV proven by a real long call.
function callHasPartialConfirmationPack(c: CallLogEnriched): boolean {
  return c.lead?.email_sent === true || c.lead?.whatsapp_sent === true
}

// CRM-side qualification claims this lead is an RDV.
function callCrmSaysRdv(c: CallLogEnriched): boolean {
  const q = (c.lead?.qualification ?? '').trim().toUpperCase()
  return q === 'RDV CONFIRME' || q === 'RDV MEDECIN'
}

// A real conversation: an answered call that lasted more than 5 minutes.
function isRealConversation(c: CallLogEnriched): boolean {
  return c.answered && c.duration > RDV_MIN_DURATION_SECONDS
}

export function isLeadRdvConfirmed(siblings: CallLogEnriched[]): boolean {
  // Path 1: full confirmation pack (email + whatsapp) + real conversation.
  // This is the strictest, most reliable path.
  if (
    siblings.some(callHasConfirmationPack) &&
    siblings.some(isRealConversation)
  ) {
    return true
  }
  // Path 2: CRM-confirmed RDV + real conversation + at least one send-pack
  // flag set. Tolerates partial n8n send-pack failures (e.g. WATI rate-limited)
  // while still requiring a real long answered call + a positive CRM tag.
  if (
    siblings.some(callCrmSaysRdv) &&
    siblings.some(isRealConversation) &&
    siblings.some(callHasPartialConfirmationPack)
  ) {
    return true
  }
  // Path 3: strict Retell call_outcome signals (legacy fallback).
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
//  2. Lead-level RDV CONFIRME (confirmation pack + real conversation, OR
//     strict call_outcome — both computed in confirmedRdvLeadKeys)
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

  // 4 — Human handoff intent: only when the call was actually answered.
  // The transfer_to_isabelle / human_transfer_triggered flags get set even
  // on 0-second / unanswered attempts, which falsely inflated the
  // "À PASSER À L'HUMAIN" card with phantom transfers. A real handoff needs
  // a real conversation first.
  if (c.analysis?.humanTransferTriggered || c.analysis?.transferToIsabelle) {
    if (c.answered) return 'a_passer_a_humain'
    // Unanswered call with a transfer flag → route by the actual disconnect
    // signal instead of the spurious handoff.
    if (c.inVoicemail || c.voicemailSuspected) return 'repondeur'
    return 'pas_de_reponse'
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
