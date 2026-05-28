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
//
// Primary signal is the Retell agent_id (stable). Retell agent NAMES don't
// reliably contain "charlotte"/"isabelle"/"victoria", so name-matching alone
// returned null and the agent-chain card showed 0 for levels 2 & 3.
const AGENT_ID_LEVEL: Record<string, 1 | 2 | 3> = {
  agent_ece06635312493aa07b2e22f13: 1, // Charlotte
  agent_e120cf0b9e9f9077633a11ba53: 2, // Isabelle
  agent_182d843fabf564e08d7cd8d472: 3, // Victoria
}

export function agentLevel(
  agentId: string | null | undefined,
  agentName?: string | null | undefined
): 1 | 2 | 3 | null {
  if (agentId && AGENT_ID_LEVEL[agentId]) return AGENT_ID_LEVEL[agentId]
  const n = (agentName ?? '').toLowerCase()
  if (!n) return null
  if (/\bagent\s*1\b/.test(n) || n.includes('charlotte')) return 1
  if (/\bagent\s*2\b/.test(n) || n.includes('isabelle')) return 2
  if (/\bagent\s*3\b/.test(n) || n.includes('victoria')) return 3
  return null
}

const REACHED_AGENT_LEVEL: Record<string, 1 | 2 | 3> = {
  charlotte: 1,
  isabelle: 2,
  victoria: 3,
}

// Furthest agent a call reached. Agents swap WITHIN a single Retell call
// (Charlotte → Isabelle → Victoria), so the call's agent_id is always the
// initiating agent (Charlotte). The reached_agent field from Retell's
// post-call analysis is the source of truth; fall back to agent_id/name.
export function callAgentLevel(c: CallLogEnriched): 1 | 2 | 3 | null {
  const ra = c.analysis?.reachedAgent?.toLowerCase().trim()
  if (ra && REACHED_AGENT_LEVEL[ra]) return REACHED_AGENT_LEVEL[ra]
  return agentLevel(c.agentId, c.agentName)
}
