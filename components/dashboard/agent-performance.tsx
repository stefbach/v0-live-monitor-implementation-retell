'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFiltersStore } from '@/lib/stores/filters-store'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { agentLevel, leadGroupKey } from '@/lib/lead-key'
import { effectiveQualKey } from '@/lib/rdv'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  filteredCalls: CallLogEnriched[]
  isLoading?: boolean
}

interface LevelRow {
  level: 1 | 2 | 3
  displayName: string
  agentIds: string[]
  calls: number
  answered: number
  answerRate: number
  rdv: number
  avgDuration: number
  totalCost: number
}

const LEVELS: { level: 1 | 2 | 3; displayName: string }[] = [
  { level: 1, displayName: 'Charlotte (Agent 1)' },
  { level: 2, displayName: 'Isabelle (Agent 2)' },
  { level: 3, displayName: 'Victoria (Agent 3)' },
]

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function AgentPerformance({
  filteredCalls,
  isLoading,
}: Props) {
  const toggle = useFiltersStore((s) => s.toggleArray)
  const selected = useFiltersStore((s) => s.filters.agents)
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)
  const selSet = new Set(selected)

  const rows: LevelRow[] = useMemo(() => {
    return LEVELS.map(({ level, displayName }) => {
      const calls = filteredCalls.filter((c) => agentLevel(c.agentId, c.agentName) === level)
      const agentIds = [
        ...new Set(calls.map((c) => c.agentId).filter(Boolean) as string[]),
      ]
      const answered = calls.filter((c) => c.answered).length
      const duration = calls.reduce((s, c) => s + c.duration, 0)
      const cost = calls.reduce((s, c) => s + (c.cost ?? 0), 0)

      // RDV credit: distinct leads with Supabase qualification = RDV MEDECIN
      // whose chain touched this agent level.
      const leadsTouched = new Set<string>()
      let rdv = 0
      for (const c of calls) {
        const k = leadGroupKey(c)
        if (!k || leadsTouched.has(k)) continue
        leadsTouched.add(k)
        if (effectiveQualKey(c, confirmedRdvLeadKeys) === 'rdv_confirme') rdv++
      }

      return {
        level,
        displayName,
        agentIds,
        calls: calls.length,
        answered,
        answerRate: calls.length > 0 ? (answered / calls.length) * 100 : 0,
        rdv,
        avgDuration:
          calls.length > 0 ? Math.round(duration / calls.length) : 0,
        totalCost: cost,
      }
    })
  }, [filteredCalls, confirmedRdvLeadKeys])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agent performance</CardTitle>
        <CardDescription>
          Charlotte → Isabelle → Victoria · regroupé par lead via{' '}
          <code>metadata.lead_id</code> + fallback téléphone
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium text-right">Calls</th>
                <th className="pb-2 font-medium text-right">RDV</th>
                <th className="pb-2 font-medium text-right">Taux décroché</th>
                <th className="pb-2 font-medium text-right">Durée moy</th>
                <th className="pb-2 font-medium text-right">Coût</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSel =
                  r.agentIds.length > 0 && r.agentIds.every((id) => selSet.has(id))
                const onClick = () => {
                  for (const id of r.agentIds) toggle('agents', id)
                }
                return (
                  <tr
                    key={r.level}
                    onClick={r.agentIds.length > 0 ? onClick : undefined}
                    className={`border-b border-border/50 transition-colors ${
                      r.agentIds.length > 0
                        ? 'cursor-pointer ' + (isSel ? 'bg-muted' : 'hover:bg-muted/50')
                        : 'opacity-60'
                    }`}
                  >
                    <td className="py-2">{r.displayName}</td>
                    <td className="py-2 text-right font-mono">
                      {r.calls.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono text-emerald-500">
                      {r.rdv.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {r.answerRate.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {formatDuration(r.avgDuration)}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {formatUsd(r.totalCost)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
