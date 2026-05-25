'use client'

import { useMemo, useState } from 'react'
import { PhoneIncoming, PhoneCall, PhoneOff, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useRdvStore } from '@/lib/stores/rdv-store'
import { effectiveQualKey } from '@/lib/rdv'
import { QUAL_META } from '@/lib/qualifications'
import { getUKParts } from '@/lib/timezone'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  calls: CallLogEnriched[]
  onSelectCall: (call: CallLogEnriched) => void
  isLoading?: boolean
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function formatDateTime(iso: string): { date: string; time: string } {
  const p = getUKParts(new Date(iso))
  if (!p) return { date: '', time: '' }
  return {
    date: `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`,
    time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
  }
}

export function InboundCallsPanel({ calls, onSelectCall, isLoading }: Props) {
  const confirmedRdvLeadKeys = useRdvStore((s) => s.confirmedRdvLeadKeys)
  const [expanded, setExpanded] = useState(false)

  const inbound = useMemo(
    () =>
      calls
        .filter((c) => c.direction === 'inbound')
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [calls]
  )

  const answeredCount = useMemo(() => inbound.filter((c) => c.answered).length, [inbound])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-emerald-500" />
            Appels entrants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left gap-3"
        >
          <div className="flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4 text-emerald-500 shrink-0" />
            <CardTitle className="text-base">Appels entrants</CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-mono text-xs px-1.5">
              {inbound.length}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <span className="hidden sm:inline">
              <span className="text-emerald-500 font-semibold">{answeredCount}</span> décroché
              {answeredCount !== 1 ? 's' : ''} ·{' '}
              <span className="text-rose-400 font-semibold">{inbound.length - answeredCount}</span> sans
              réponse
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {inbound.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun appel entrant sur cette période.
            </p>
          ) : (
            <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
              {/* Column header */}
              <div className="grid grid-cols-[20px_72px_130px_1fr_56px_130px] gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border/40 mb-1">
                <span />
                <span>Date</span>
                <span>Numéro</span>
                <span>Lead</span>
                <span>Durée</span>
                <span>Qualification</span>
              </div>

              {inbound.map((call) => {
                const qualKey = effectiveQualKey(call, confirmedRdvLeadKeys)
                const meta = QUAL_META[qualKey]
                const { date, time } = formatDateTime(call.startTime)
                return (
                  <button
                    key={call.callId}
                    onClick={() => onSelectCall(call)}
                    className="w-full grid grid-cols-[20px_72px_130px_1fr_56px_130px] gap-2 items-center rounded-md border border-border/30 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                  >
                    {/* Answered icon */}
                    <span className="flex items-center justify-center">
                      {call.answered ? (
                        <PhoneCall className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <PhoneOff className="h-3.5 w-3.5 text-rose-400" />
                      )}
                    </span>

                    {/* Date + time */}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      <span className="block">{date}</span>
                      <span className="block">{time}</span>
                    </span>

                    {/* Phone number */}
                    <span className="font-mono text-xs truncate">{call.fromNumber || '—'}</span>

                    {/* Lead name */}
                    <span className="text-xs text-muted-foreground truncate">
                      {call.lead?.nom ?? ''}
                    </span>

                    {/* Duration */}
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatDuration(call.duration)}
                    </span>

                    {/* Qualification badge */}
                    <span className="flex justify-end">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 leading-4 font-medium ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </Badge>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
