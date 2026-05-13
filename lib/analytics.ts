import type {
  CallLogEnriched,
  HeatmapDayHourCell,
  AttemptStat,
  AgentChainNode,
  AgentChainEdge,
  VerbatimEntry,
  DeltaValue,
} from './types'

// ─── Day × Hour heatmap (24 × 7) ────────────────────────────────────────────

export function computeHeatmap(calls: CallLogEnriched[]): HeatmapDayHourCell[] {
  const cells: HeatmapDayHourCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({
      dayOfWeek: 0,
      hour: 0,
      total: 0,
      answered: 0,
      rdv: 0,
      answerRate: 0,
      rdvRate: 0,
    }))
  )
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells[d][h].dayOfWeek = d
      cells[d][h].hour = h
    }
  }
  for (const c of calls) {
    const d = c.dayOfWeek
    const h = c.hourOfDay
    if (d < 0 || d > 6 || h < 0 || h > 23) continue
    const cell = cells[d][h]
    cell.total++
    if (c.answered) cell.answered++
    if (c.lead?.qualification === 'RDV MEDECIN') cell.rdv++
  }
  const flat: HeatmapDayHourCell[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const cell = cells[d][h]
      cell.answerRate = cell.total > 0 ? (cell.answered / cell.total) * 100 : 0
      cell.rdvRate = cell.total > 0 ? (cell.rdv / cell.total) * 100 : 0
      flat.push(cell)
    }
  }
  return flat
}

// ─── Attempt funnel ─────────────────────────────────────────────────────────

export function computeAttemptStats(calls: CallLogEnriched[]): AttemptStat[] {
  // Group calls by lead (phone fallback to call.id when no lead)
  const byLead = new Map<string, CallLogEnriched[]>()
  for (const c of calls) {
    const key = c.lead?.numero_telephone || c.lead?.id || c.id
    if (!byLead.has(key)) byLead.set(key, [])
    byLead.get(key)!.push(c)
  }

  // Per-attempt aggregation
  const maxAttempt = Math.max(...calls.map((c) => c.attemptNumber), 0)
  const stats: AttemptStat[] = []
  for (let n = 1; n <= Math.max(maxAttempt, 3); n++) {
    let leadsReached = 0
    let answered = 0
    let rdv = 0
    for (const list of byLead.values()) {
      const callAtN = list.find((c) => c.attemptNumber === n)
      if (!callAtN) continue
      leadsReached++
      if (callAtN.answered) answered++
      // RDV credited if any call in this lead's history ended in RDV
      if (list.some((c) => c.lead?.qualification === 'RDV MEDECIN')) rdv++
    }
    stats.push({
      attempt: n,
      leadsReached,
      answered,
      rdv,
      answerRate: leadsReached > 0 ? (answered / leadsReached) * 100 : 0,
      rdvRate: leadsReached > 0 ? (rdv / leadsReached) * 100 : 0,
    })
  }
  return stats
}

// ─── Agent chain (handoff graph) ────────────────────────────────────────────

export function computeAgentChain(
  calls: CallLogEnriched[],
  agentNames: Record<string, string>
): { nodes: AgentChainNode[]; edges: AgentChainEdge[] } {
  // Per-lead sequence of agents (in order)
  const sequencesByLead = new Map<string, string[]>()
  const rdvByLead = new Map<string, boolean>()
  // Sort once globally
  const sorted = [...calls].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  for (const c of sorted) {
    const key = c.lead?.numero_telephone || c.lead?.id || c.id
    const seq = sequencesByLead.get(key) ?? []
    if (c.agentId && seq[seq.length - 1] !== c.agentId) seq.push(c.agentId)
    sequencesByLead.set(key, seq)
    if (c.lead?.qualification === 'RDV MEDECIN') rdvByLead.set(key, true)
  }

  // Nodes: leads reached per agent + RDV outcome
  const reachedByAgent = new Map<string, number>()
  const rdvByAgent = new Map<string, number>()
  // Edges: A -> B transitions, counted once per lead per pair
  const edgeKey = (a: string, b: string) => `${a}>>${b}`
  const edgeCounts = new Map<string, number>()

  for (const [leadKey, seq] of sequencesByLead.entries()) {
    const visited = new Set<string>()
    for (const a of seq) visited.add(a)
    for (const a of visited) {
      reachedByAgent.set(a, (reachedByAgent.get(a) ?? 0) + 1)
      if (rdvByLead.get(leadKey)) rdvByAgent.set(a, (rdvByAgent.get(a) ?? 0) + 1)
    }
    for (let i = 0; i < seq.length - 1; i++) {
      if (seq[i] === seq[i + 1]) continue
      const k = edgeKey(seq[i], seq[i + 1])
      edgeCounts.set(k, (edgeCounts.get(k) ?? 0) + 1)
    }
  }

  const nodes: AgentChainNode[] = [...reachedByAgent.entries()]
    .map(([agentId, reached]) => {
      const rdv = rdvByAgent.get(agentId) ?? 0
      return {
        agentId,
        agentName: agentNames[agentId] || agentId.slice(0, 8),
        reached,
        rdv,
        conversionRate: reached > 0 ? (rdv / reached) * 100 : 0,
      }
    })
    .sort((a, b) => b.reached - a.reached)

  const edges: AgentChainEdge[] = [...edgeCounts.entries()]
    .map(([k, count]) => {
      const [a, b] = k.split('>>')
      return {
        fromAgentId: a,
        fromAgentName: agentNames[a] || a.slice(0, 8),
        toAgentId: b,
        toAgentName: agentNames[b] || b.slice(0, 8),
        count,
      }
    })
    .sort((a, b) => b.count - a.count)

  return { nodes, edges }
}

// ─── Verbatim ───────────────────────────────────────────────────────────────

export function extractVerbatims(
  calls: CallLogEnriched[],
  qualification?: string
): VerbatimEntry[] {
  return calls
    .filter((c) => c.summary && c.summary.length > 10)
    .filter((c) => (qualification ? c.lead?.qualification === qualification : true))
    .map((c) => ({
      callId: c.callId,
      qualification: c.lead?.qualification ?? null,
      summary: c.summary ?? '',
      agentName: c.agentName,
      duration: c.duration,
      startTime: c.startTime,
      leadName: c.lead?.nom ?? null,
    }))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
}

// ─── Cost by hour & by outcome ──────────────────────────────────────────────

export function computeCostByHour(calls: CallLogEnriched[]): { hour: number; cost: number; calls: number }[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, cost: 0, calls: 0 }))
  for (const c of calls) {
    const h = c.hourOfDay
    if (h < 0 || h > 23) continue
    buckets[h].cost += c.cost ?? 0
    buckets[h].calls += 1
  }
  return buckets
}

export function computeCostByOutcome(
  calls: CallLogEnriched[]
): { qualification: string; cost: number; calls: number; rdv: number }[] {
  const map = new Map<string, { cost: number; calls: number; rdv: number }>()
  for (const c of calls) {
    const q = c.lead?.qualification ?? 'UNMATCHED'
    const v = map.get(q) ?? { cost: 0, calls: 0, rdv: 0 }
    v.cost += c.cost ?? 0
    v.calls += 1
    if (q === 'RDV MEDECIN') v.rdv += 1
    map.set(q, v)
  }
  return [...map.entries()]
    .map(([qualification, v]) => ({ qualification, ...v }))
    .sort((a, b) => b.cost - a.cost)
}

// ─── Delta helper ───────────────────────────────────────────────────────────

export function makeDelta(current: number, previous: number): DeltaValue {
  const delta = current - previous
  const pctChange = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0
  return { current, previous, delta, pctChange }
}
