'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  ChevronUp,
  ChevronDown,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from './skeleton-loaders'
import { computeEligibilityFromSummary } from '@/lib/eligibility'
import type { CallLogEnriched, Qualification } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
  onCallSelect?: (call: CallLogEnriched) => void
}

type SortField = 'startTime' | 'duration' | 'status' | 'cost' | 'attempt'
type SortDirection = 'asc' | 'desc'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

const QUALIF_STYLE: Record<string, string> = {
  'RDV MEDECIN': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  'NOUVEAU DOSSIER': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  'PAS INTERESSE': 'bg-red-500/10 text-red-400 border-red-500/30',
  'PAS DE REPONSE': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  'FAUX NUMERO': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'FOLLOW UP': 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  TRANSFERRED_TO_ISABELLE: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
}

function getQualifBadge(q: Qualification | null | undefined) {
  if (!q) return <span className="text-xs text-muted-foreground">—</span>
  const cls = QUALIF_STYLE[q] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
  return (
    <Badge variant="outline" className={cls}>
      {q}
    </Badge>
  )
}

export function CallLogsTable({ calls, isLoading, onCallSelect }: Props) {
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const sorted = useMemo(() => {
    const result = [...calls]
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'startTime':
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'cost':
          comparison = (a.cost ?? 0) - (b.cost ?? 0)
          break
        case 'attempt':
          comparison = a.attemptNumber - b.attemptNumber
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return result
  }, [calls, sortField, sortDirection])

  const paginated = useMemo(() => {
    const start = page * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page])

  const totalPages = Math.ceil(sorted.length / pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    )
  }

  if (isLoading) return <TableSkeleton rows={pageSize} />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Call logs</CardTitle>
        <CardDescription>
          {sorted.length.toLocaleString()} calls match the current filters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">
                    <button onClick={() => handleSort('startTime')} className="flex items-center gap-1 hover:text-foreground">
                      Time <SortIcon field="startTime" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium">Patient</th>
                  <th className="pb-3 font-medium text-right">BMI</th>
                  <th className="pb-3 font-medium">Elig.</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Qualification</th>
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium text-right">
                    <button onClick={() => handleSort('attempt')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      # <SortIcon field="attempt" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium text-center">Ans.</th>
                  <th className="pb-3 font-medium text-right">
                    <button onClick={() => handleSort('duration')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      Dur. <SortIcon field="duration" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium text-right">
                    <button onClick={() => handleSort('cost')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      Cost <SortIcon field="cost" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((call) => {
                  const lead = call.lead
                  const elig = computeEligibilityFromSummary(lead)
                  return (
                    <tr
                      key={call.id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onCallSelect?.(call)}
                    >
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          {call.direction === 'inbound' ? (
                            <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <PhoneOutgoing className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          {call.startTime ? format(new Date(call.startTime), 'MMM d, HH:mm') : '—'}
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        <div>
                          <p className="font-medium truncate max-w-[160px]">
                            {lead?.nom ?? call.userName ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-sm font-mono text-right">
                        {lead?.bmi != null ? lead.bmi.toFixed(1) : '—'}
                      </td>
                      <td className="py-3">
                        {elig.eligible ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                            ✓
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground truncate max-w-[100px]">
                        {lead?.source_lead ?? '—'}
                      </td>
                      <td className="py-3">{getQualifBadge(lead?.qualification)}</td>
                      <td className="py-3 text-sm truncate max-w-[120px]">{call.agentName}</td>
                      <td className="py-3 text-sm font-mono text-right">{call.attemptNumber}</td>
                      <td className="py-3 text-center">
                        {call.answered ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 inline" />
                        )}
                      </td>
                      <td className="py-3 text-sm font-mono text-right">{formatDuration(call.duration)}</td>
                      <td className="py-3 text-sm font-mono text-right text-muted-foreground">
                        {formatUsd(call.cost)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {paginated.map((call) => {
            const lead = call.lead
            const elig = computeEligibilityFromSummary(lead)
            return (
              <div
                key={call.id}
                className="rounded-lg border border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onCallSelect?.(call)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-5 w-5 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-1">
                        {lead?.nom ?? 'Unknown'}
                        {elig.eligible && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                            Elig
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{call.agentName}</p>
                    </div>
                  </div>
                  {getQualifBadge(lead?.qualification)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Call #{call.attemptNumber} · BMI {lead?.bmi != null ? lead.bmi.toFixed(1) : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    {call.answered ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{call.startTime ? format(new Date(call.startTime), 'MMM d, HH:mm') : '—'}</span>
                  <span className="font-mono">
                    {formatDuration(call.duration)} · {formatUsd(call.cost)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of{' '}
              {sorted.length.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">No calls match the current filters.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
