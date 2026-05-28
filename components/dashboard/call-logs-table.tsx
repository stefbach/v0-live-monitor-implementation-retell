'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  ChevronUp,
  ChevronDown,
  Phone,
  CheckCircle2,
  XCircle,
  Link2,
  Headphones,
  FileText,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from './skeleton-loaders'
import { DirectionIcon } from './direction-indicator'
import { QUAL_META } from '@/lib/qualifications'
import { CRENEAUX } from '@/lib/timezone'
import { callAgentLevel } from '@/lib/director-metrics'
import { effectiveQualKey } from '@/lib/rdv'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { useT } from '@/lib/hooks/use-t'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  isLoading?: boolean
  onCallSelect?: (call: CallLogEnriched) => void
}

type SortField = 'startTime' | 'duration' | 'cost' | 'phase'
type SortDirection = 'asc' | 'desc'

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${seconds}s (${m}:${s.toString().padStart(2, '0')})`
}

function fmtUsd(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export function CallLogsTable({
  calls,
  isLoading,
  onCallSelect,
}: Props) {
  const { t } = useT()
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 20

  // Which leads went through more than one distinct agent (chain icon)
  const multiAgentLeads = useMemo(() => {
    const byLead = new Map<string, Set<number>>()
    for (const c of calls) {
      const k = c.meta?.leadId ?? c.lead?.id
      if (!k) continue
      const lvl = callAgentLevel(c)
      if (!lvl) continue
      if (!byLead.has(k)) byLead.set(k, new Set())
      byLead.get(k)!.add(lvl)
    }
    const s = new Set<string>()
    for (const [k, levels] of byLead.entries()) if (levels.size > 1) s.add(k)
    return s
  }, [calls])

  const sorted = useMemo(() => {
    const result = [...calls]
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'startTime':
          cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          break
        case 'duration':
          cmp = a.duration - b.duration
          break
        case 'cost':
          cmp = (a.cost ?? 0) - (b.cost ?? 0)
          break
        case 'phase':
          cmp = (a.meta?.phase ?? '').localeCompare(b.meta?.phase ?? '')
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return result
  }, [calls, sortField, sortDirection])

  const paginated = useMemo(
    () => sorted.slice(page * pageSize, page * pageSize + pageSize),
    [sorted, page]
  )
  const totalPages = Math.ceil(sorted.length / pageSize)

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(f)
      setSortDirection('desc')
    }
  }
  const SortIcon = ({ f }: { f: SortField }) =>
    sortField !== f ? null : sortDirection === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    )

  if (isLoading) return <TableSkeleton rows={pageSize} />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('logs.title')}</CardTitle>
        <CardDescription>
          {t('logs.subtitle').replace('{n}', sorted.length.toLocaleString())}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-3 font-medium">{t('logs.col.lead')}</th>
                <th className="pb-3 font-medium">{t('logs.col.phone')}</th>
                <th className="pb-3 font-medium">
                  <button onClick={() => handleSort('phase')} className="flex items-center gap-1 hover:text-foreground">
                    {t('logs.col.phaseCreneau')} <SortIcon f="phase" />
                  </button>
                </th>
                <th className="pb-3 font-medium">{t('logs.col.agents')}</th>
                <th className="pb-3 font-medium text-right">
                  <button onClick={() => handleSort('duration')} className="ml-auto flex items-center gap-1 hover:text-foreground">
                    {t('logs.col.duration')} <SortIcon f="duration" />
                  </button>
                </th>
                <th className="pb-3 font-medium">{t('logs.col.qualification')}</th>
                <th className="pb-3 font-medium text-center">{t('logs.col.answered')}</th>
                <th className="pb-3 font-medium">
                  <button onClick={() => handleSort('startTime')} className="flex items-center gap-1 hover:text-foreground">
                    {t('logs.col.time')} <SortIcon f="startTime" />
                  </button>
                </th>
                <th className="pb-3 font-medium text-right">
                  <button onClick={() => handleSort('cost')} className="ml-auto flex items-center gap-1 hover:text-foreground">
                    {t('logs.col.cost')} <SortIcon f="cost" />
                  </button>
                </th>
                <th className="pb-3 font-medium text-right">{t('logs.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((call) => {
                const lead = call.lead
                const q = QUAL_META[effectiveQualKey(call, confirmedRdvLeadKeys)]
                const lvl = callAgentLevel(call)
                const leadKey = call.meta?.leadId ?? lead?.id
                const isMulti = leadKey ? multiAgentLeads.has(leadKey) : false
                return (
                  <tr
                    key={call.id}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                    onClick={() => onCallSelect?.(call)}
                  >
                    <td className="py-3 text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        <DirectionIcon
                          direction={call.direction}
                          size="sm"
                          className="shrink-0"
                        />
                        <span className="max-w-[150px] truncate">
                          {lead?.nom ?? call.userName ?? 'Inconnu'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {lead?.numero_telephone ??
                        (call.direction === 'inbound' ? call.fromNumber : call.toNumber)}
                    </td>
                    <td className="py-3 text-xs">
                      <Badge variant="outline" className="mr-1">
                        {call.meta?.phase ?? '—'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {CRENEAUX[call.creneau].short}
                      </span>
                    </td>
                    <td className="py-3 text-sm">
                      <span className="flex items-center gap-1">
                        {isMulti && <Link2 className="h-3.5 w-3.5 text-cyan-500" />}
                        <span className="max-w-[130px] truncate">
                          {lvl ? `A${lvl} · ` : ''}
                          {call.agentName}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono text-xs">
                      {fmtDur(call.duration)}
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className={q.badgeClass}>
                        {q.label}
                      </Badge>
                    </td>
                    <td className="py-3 text-center">
                      {call.answered ? (
                        <CheckCircle2 className="inline h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="inline h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="py-3 text-xs">
                      {call.startTime ? format(new Date(call.startTime), 'dd/MM HH:mm') : '—'}
                    </td>
                    <td className="py-3 text-right font-mono text-xs text-muted-foreground">
                      {fmtUsd(call.cost)}
                    </td>
                    <td className="py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          title="Écouter"
                          onClick={() => onCallSelect?.(call)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Headphones className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          title="Transcription"
                          onClick={() => onCallSelect?.(call)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          title="Détails"
                          onClick={() => onCallSelect?.(call)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Compact cards on small screens */}
        <div className="flex flex-col gap-3 lg:hidden">
          {paginated.map((call) => {
            const lead = call.lead
            const q = QUAL_META[effectiveQualKey(call, confirmedRdvLeadKeys)]
            return (
              <button
                key={call.id}
                onClick={() => onCallSelect?.(call)}
                className="rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead?.nom ?? 'Inconnu'}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {lead?.numero_telephone ?? call.toNumber}
                    </p>
                  </div>
                  <Badge variant="outline" className={q.badgeClass}>
                    {q.label}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {call.meta?.phase ?? '—'} · {CRENEAUX[call.creneau].short} ·{' '}
                    {call.agentName}
                  </span>
                  <span className="font-mono">
                    {call.duration}s · {fmtUsd(call.cost)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {page * pageSize + 1}-
              {Math.min((page + 1) * pageSize, sorted.length)} sur{' '}
              {sorted.length.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              Aucun appel ne correspond aux filtres.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
