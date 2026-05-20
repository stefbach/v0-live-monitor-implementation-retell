'use client'

import { format } from 'date-fns'
import { PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { QUAL_META } from '@/lib/qualifications'
import { CRENEAUX } from '@/lib/timezone'
import { effectiveQualKey } from '@/lib/rdv'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  calls: CallLogEnriched[]
  onSelectCall: (call: CallLogEnriched) => void
  showRaw?: boolean // show raw Retell status instead of mapped qualif badge
  confirmedRdvLeadKeys?: Set<string>
}

function rawStatus(c: CallLogEnriched): string {
  return (
    c.lead?.qualification ||
    c.analysis?.callOutcome ||
    c.disconnectionReason ||
    c.status ||
    '—'
  )
}

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function DetailSlideOver({
  open,
  onOpenChange,
  title,
  subtitle,
  calls,
  onSelectCall,
  showRaw,
  confirmedRdvLeadKeys,
}: Props) {
  const confirmed = confirmedRdvLeadKeys ?? new Set<string>()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {subtitle ?? `${calls.length.toLocaleString()} appel(s) concerné(s)`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-2">
          {calls.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun appel.
            </p>
          )}
          {calls.slice(0, 200).map((c) => {
            const q = QUAL_META[effectiveQualKey(c, confirmed)]
            return (
              <button
                key={c.id}
                onClick={() => onSelectCall(c)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    {c.direction === 'inbound' ? (
                      <PhoneIncoming className="h-4 w-4 text-blue-500" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.lead?.nom ?? c.userName ?? 'Inconnu'}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.lead?.numero_telephone ??
                        (c.direction === 'inbound' ? c.fromNumber : c.toNumber)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {showRaw ? (
                    <Badge
                      variant="outline"
                      className="bg-zinc-500/10 text-zinc-300 border-zinc-500/30 font-mono"
                    >
                      {rawStatus(c)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={q.badgeClass}>
                      {q.label}
                    </Badge>
                  )}
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.answered ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                    <span className="font-mono">{fmtDur(c.duration)}</span>
                    <span>{CRENEAUX[c.creneau].short}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.startTime ? format(new Date(c.startTime), 'dd/MM HH:mm') : '—'}
                    {c.meta?.phase ? ` · ${c.meta.phase}` : ''}
                  </span>
                </div>
              </button>
            )
          })}
          {calls.length > 200 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              + {(calls.length - 200).toLocaleString()} de plus — affine via les filtres.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
