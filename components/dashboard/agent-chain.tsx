'use client'

import { useMemo } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { computeAgentChain } from '@/lib/analytics'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  agentNames: Record<string, string>
  isLoading?: boolean
}

export function AgentChain({ calls, agentNames, isLoading }: Props) {
  const { nodes, edges } = useMemo(
    () => computeAgentChain(calls, agentNames),
    [calls, agentNames]
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent chain</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  const maxReached = Math.max(...nodes.map((n) => n.reached), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-500" />
          Agent chain & handoffs
        </CardTitle>
        <CardDescription>
          Which agent each lead reached, and where conversations got handed off
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent activity in the current view.</p>
        ) : (
          <>
            {/* Per-agent reach + conversion */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Leads reached per agent
              </p>
              {nodes.map((n) => (
                <div key={n.agentId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">{n.agentName}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>{n.reached.toLocaleString()} leads</span>
                      <span className="text-emerald-500 font-semibold">
                        {n.rdv.toLocaleString()} RDV ({n.conversionRate.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="relative h-5 overflow-hidden rounded bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full bg-cyan-500/40"
                      style={{ width: `${(n.reached / maxReached) * 100}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-emerald-500/70"
                      style={{ width: `${(n.rdv / maxReached) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Handoff edges */}
            {edges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Top handoffs
                </p>
                <div className="space-y-1">
                  {edges.slice(0, 8).map((e) => (
                    <div
                      key={`${e.fromAgentId}-${e.toAgentId}`}
                      className="flex items-center justify-between rounded-md border border-border/50 px-3 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate max-w-[140px]">{e.fromAgentName}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[140px]">{e.toAgentName}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {e.count.toLocaleString()}{' '}
                        <span className="text-xs">leads</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
