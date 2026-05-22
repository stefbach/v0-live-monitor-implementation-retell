'use client'

import { format } from 'date-fns'
import { CheckCircle2, XCircle, CalendarClock } from 'lucide-react'
import { DirectionIcon } from '../direction-indicator'
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
  showRappelDate?: boolean // surface the lead's rappel_rdv datetime per row
  showSummary?: boolean // surface the call summary text under each row
}

function fmtRappel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'dd/MM/yyyy HH:mm')
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
  showRappelDate,
  showSummary,
}: Props) {
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
            const q = QUAL_META[effectiveQualKey(c)]
            return (
              <button
                key={c.id}
                onClick={() => onSelectCall(c)}
                className="rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <DirectionIcon direction={c.direction} size="md" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.lead?.nom ?? c.userName ?? 'Inconnu'}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.lead?.numero_telephone ??
                        (c.direction === 'inbound' ? c.fromNumber : c.toNumber)}
                    </p>
                    {showRappelDate && fmtRappel(c.lead?.rappel_rdv) && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-orange-400">
                        <CalendarClock className="h-3 w-3" />
                        Rappel prévu : {fmtRappel(c.lead?.rappel_rdv)}
                      </p>
                    )}
                    {showRappelDate && !fmtRappel(c.lead?.rappel_rdv) && (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                        Pas de date de rappel renseignée
                      </p>
                    )}
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
                </div>
                {showSummary && c.summary && (
                  <p className="mt-2 line-clamp-3 rounded bg-muted/30 p-2 text-xs leading-relaxed text-muted-foreground">
                    {c.summary}
                  </p>
                )}
                {showSummary && !c.summary && (
                  <p className="mt-2 text-[11px] italic text-muted-foreground">
                    Pas de résumé d&apos;appel disponible.
                  </p>
                )}
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
