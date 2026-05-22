import type { CallLogEnriched } from './types'
import { qualKeyFromRaw, type QualKey } from './qualifications'

// Final bucket for any call.
//
// Source of truth = leads_rdv.qualification (Supabase). No Retell-
// derived overlay: call_outcome / transfer_to_isabelle / robot_awareness
// were causing the qualification counts to diverge from the CRM, and the
// dashboard now reflects the CRM exactly. n8n Agent 2 is responsible
// for writing the correct qualification back to leads_rdv after each
// call — the dashboard just displays it.
//
// Anything outside the 9 cards (unknown value, missing qualification,
// inbound without a matching lead) is routed to 'pas_de_reponse' in
// qualKeyFromRaw() so every call lives in exactly one card.
export function effectiveQualKey(c: CallLogEnriched): QualKey {
  return qualKeyFromRaw(c.lead?.qualification)
}
