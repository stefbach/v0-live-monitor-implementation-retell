import type { CallLogEnriched } from './types'
import { normalizePhone, pickCounterpartyNumber } from './phone'

// Stable grouping key for "the same lead across multiple calls".
// metadata.lead_id is the source of truth, but older calls (placed
// before the n8n metadata rollout) may not have it — fall back to the
// matched CRM lead id, then to the normalised counterparty phone so
// those calls are still grouped instead of being dropped.
export function leadGroupKey(c: CallLogEnriched): string | null {
  if (c.meta?.leadId) return c.meta.leadId
  if (c.lead?.id) return c.lead.id
  const phone = normalizePhone(
    pickCounterpartyNumber(c.direction, c.fromNumber, c.toNumber)
  )
  return phone || null
}

export function hasMetadata(c: CallLogEnriched): boolean {
  return !!c.meta?.leadId
}

// Charlotte = level 1, Isabelle = level 2, Victoria = level 3.
export function agentLevel(agentName: string | null | undefined): 1 | 2 | 3 | null {
  if (!agentName) return null
  const n = agentName.toLowerCase()
  if (/\bagent\s*1\b/.test(n) || n.includes('charlotte')) return 1
  if (/\bagent\s*2\b/.test(n) || n.includes('isabelle')) return 2
  if (/\bagent\s*3\b/.test(n) || n.includes('victoria')) return 3
  return null
}
