'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from './skeleton-loaders'
import type { CallLogEnriched, Qualification } from '@/lib/types'

interface CallLogsTableProps {
  calls: CallLogEnriched[]
  isLoading?: boolean
  onCallSelect?: (call: CallLogEnriched) => void
}

type SortField = 'startTime' | 'duration' | 'status' | 'cost'
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

function getStatusBadge(status: CallLogEnriched['status']) {
  const variants: Record<CallLogEnriched['status'], { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    active: { label: 'Active', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    'no-answer': { label: 'No Answer', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    busy: { label: 'Busy', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  }
  const variant = variants[status]
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  )
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

export function CallLogsTable({ calls, isLoading, onCallSelect }: CallLogsTableProps) {
  const [search, setSearch] = useState('')
  const [qualifFilter, setQualifFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 15

  const allQualifs = useMemo(() => {
    const set = new Set<string>()
    for (const c of calls) if (c.lead?.qualification) set.add(c.lead.qualification)
    return [...set]
  }, [calls])

  const filteredAndSortedCalls = useMemo(() => {
    let result = [...calls]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.agentName.toLowerCase().includes(s) ||
          c.userName?.toLowerCase().includes(s) ||
          c.lead?.nom?.toLowerCase().includes(s) ||
          c.lead?.email?.toLowerCase().includes(s) ||
          c.fromNumber.includes(search) ||
          c.toNumber.includes(search)
      )
    }
    if (qualifFilter !== 'all') {
      result = result.filter((c) => c.lead?.qualification === qualifFilter)
    }
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
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return result
  }, [calls, search, qualifFilter, sortField, sortDirection])

  const paginatedCalls = useMemo(() => {
    const start = page * pageSize
    return filteredAndSortedCalls.slice(start, start + pageSize)
  }, [filteredAndSortedCalls, page])

  const totalPages = Math.ceil(filteredAndSortedCalls.length / pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  if (isLoading) {
    return <TableSkeleton rows={pageSize} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Call Logs ({filteredAndSortedCalls.length})</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={qualifFilter}
              onChange={(e) => {
                setQualifFilter(e.target.value)
                setPage(0)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All qualifications</option>
              {allQualifs.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient, number, agent…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
          </div>
        </div>
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
                  <th className="pb-3 font-medium">BMI</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Qualification</th>
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium text-right">
                    <button onClick={() => handleSort('duration')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      Duration <SortIcon field="duration" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium text-right">
                    <button onClick={() => handleSort('cost')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      Cost <SortIcon field="cost" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-foreground">
                      Status <SortIcon field="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCalls.map((call) => {
                  const lead = call.lead
                  return (
                    <tr
                      key={call.id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onCallSelect?.(call)}
                    >
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-2">
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
                          <p className="font-medium truncate max-w-[180px]">
                            {lead?.nom ?? call.userName ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-sm font-mono">
                        {lead?.bmi != null ? lead.bmi.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 text-xs">
                        <span className="text-muted-foreground">{lead?.source_lead ?? '—'}</span>
                      </td>
                      <td className="py-3">{getQualifBadge(lead?.qualification)}</td>
                      <td className="py-3 text-sm truncate max-w-[140px]">{call.agentName}</td>
                      <td className="py-3 text-sm font-mono text-right">{formatDuration(call.duration)}</td>
                      <td className="py-3 text-sm font-mono text-right text-muted-foreground">
                        {formatUsd(call.cost)}
                      </td>
                      <td className="py-3">{getStatusBadge(call.status)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {paginatedCalls.map((call) => {
            const lead = call.lead
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
                      <p className="font-medium truncate">{lead?.nom ?? call.userName ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{call.agentName}</p>
                    </div>
                  </div>
                  {getStatusBadge(call.status)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {getQualifBadge(lead?.qualification)}
                  <span className="text-xs text-muted-foreground">
                    BMI {lead?.bmi != null ? lead.bmi.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
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
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredAndSortedCalls.length)} of{' '}
              {filteredAndSortedCalls.length}
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

        {filteredAndSortedCalls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              {search ? 'No calls match your search' : 'No calls yet'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
