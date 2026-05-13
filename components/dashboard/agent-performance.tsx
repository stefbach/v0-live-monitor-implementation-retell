'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFiltersStore } from '@/lib/stores/filters-store'
import type { AgentPerformance as Perf } from '@/lib/types'

interface Props {
  agents: Perf[]
  isLoading?: boolean
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function AgentPerformance({ agents, isLoading }: Props) {
  const toggle = useFiltersStore((s) => s.toggleArray)
  const selected = useFiltersStore((s) => s.filters.agents)
  const selSet = new Set(selected)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agent performance</CardTitle>
        <CardDescription>Click a row to filter the dashboard by that agent</CardDescription>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium text-right">Calls</th>
                  <th className="pb-2 font-medium text-right">RDV</th>
                  <th className="pb-2 font-medium text-right">Rate</th>
                  <th className="pb-2 font-medium text-right">Avg dur</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const isSel = selSet.has(a.agentId)
                  return (
                    <tr
                      key={a.agentId}
                      onClick={() => toggle('agents', a.agentId)}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        isSel ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                    >
                      <td className="py-2 truncate max-w-[200px]">{a.agentName}</td>
                      <td className="py-2 text-right font-mono">{a.calls.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-emerald-500">
                        {a.rdv.toLocaleString()}
                      </td>
                      <td className="py-2 text-right font-mono">{a.rdvRate.toFixed(1)}%</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {formatDuration(a.avgDuration)}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {formatUsd(a.totalCost)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
