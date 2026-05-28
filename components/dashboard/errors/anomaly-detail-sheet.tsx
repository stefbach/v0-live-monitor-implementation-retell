'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  UserPlus,
  Link2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DirectionIcon } from '../direction-indicator'
import { normalizePhone, pickCounterpartyNumber } from '@/lib/phone'
import { CRENEAUX } from '@/lib/timezone'
import { callAgentLevel, leadGroupKey } from '@/lib/lead-key'
import { formatBmi } from '@/lib/bmi'
import type { CallLogEnriched, Lead } from '@/lib/types'
import type { Anomaly } from '@/lib/live-alerts'

interface Props {
  anomaly: Anomaly | null
  allCalls: CallLogEnriched[]
  leads: Lead[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function AnomalyDetailSheet({
  anomaly,
  allCalls,
  leads,
  open,
  onOpenChange,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  // Resolve the anomaly's underlying calls + (optional) candidate lead
  const { calls, leadCandidate } = useMemo(() => {
    if (!anomaly) return { calls: [] as CallLogEnriched[], leadCandidate: null }
    if (anomaly.kind === 'repeated_no_connect') {
      // anomaly.key = the offending phone number (to_number or from_number)
      const num = anomaly.key
      const matched = allCalls.filter(
        (c) => c.toNumber === num || c.fromNumber === num
      )
      const lead =
        leads.find(
          (l) =>
            l.numero_telephone === num ||
            normalizePhone(l.numero_telephone ?? '') === normalizePhone(num)
        ) ?? null
      return { calls: matched, leadCandidate: lead }
    }
    if (anomaly.kind === 'max_attempts_never_reached') {
      // anomaly.key = leadGroupKey()
      const matched = allCalls.filter((c) => leadGroupKey(c) === anomaly.key)
      const lead = leads.find((l) => l.id === anomaly.key) ?? null
      return { calls: matched, leadCandidate: lead }
    }
    // missing_metadata: all calls without meta.lead_id
    const matched = allCalls.filter((c) => !c.meta?.leadId)
    return { calls: matched, leadCandidate: null }
  }, [anomaly, allCalls, leads])

  // For missing_metadata: candidate lead per call (by phone)
  const leadByPhone = useMemo(() => {
    const m = new Map<string, Lead>()
    for (const l of leads) {
      const k = normalizePhone(l.numero_telephone ?? '')
      if (k) m.set(k, l)
    }
    return m
  }, [leads])

  const markFalseNumber = async (leadId: string) => {
    setBusy(leadId + 'faux')
    try {
      const res = await fetch(`/api/leads/${leadId}/qualification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualification: 'FAUX NUMERO' }),
      })
      if (res.ok) {
        setDone((d) => ({ ...d, [leadId]: 'FAUX NUMERO' }))
        onRefresh?.()
      }
    } finally {
      setBusy(null)
    }
  }

  const assign = async (leadId: string, to: string, reason: string) => {
    setBusy(leadId + to)
    try {
      const res = await fetch('/api/dashboard/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          assignedTo: to,
          reason,
          assignedBy: 'dashboard',
        }),
      })
      if (res.ok) setDone((d) => ({ ...d, [leadId + 'assign']: to }))
    } finally {
      setBusy(null)
    }
  }

  if (!anomaly) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {anomaly.label}
          </SheetTitle>
          <SheetDescription>{anomaly.detail}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Lead candidate header */}
          {leadCandidate && (
            <section className="rounded-lg border bg-muted/20 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-400">
                Lead identifié
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>
                  <strong>{leadCandidate.nom ?? 'Inconnu'}</strong>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {leadCandidate.numero_telephone}
                </p>
                <p className="text-xs text-muted-foreground">
                  BMI {formatBmi(leadCandidate.bmi, '—').text}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leadCandidate.qualification ?? '—'}
                </p>
              </div>
              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {done[leadCandidate.id] ? (
                  <Badge className="bg-emerald-500 text-white">
                    ✓ Marqué {done[leadCandidate.id]}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === leadCandidate.id + 'faux'}
                    onClick={() => markFalseNumber(leadCandidate.id)}
                  >
                    {busy === leadCandidate.id + 'faux' && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Marquer FAUX NUMERO
                  </Button>
                )}
                {done[leadCandidate.id + 'assign'] ? (
                  <Badge className="bg-emerald-500 text-white">
                    Confié à {done[leadCandidate.id + 'assign']}
                  </Badge>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        assign(leadCandidate.id, 'Rain', anomaly.label)
                      }
                    >
                      {busy === leadCandidate.id + 'Rain' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      <UserPlus className="mr-1 h-3 w-3" />
                      Confier à Rain
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        assign(leadCandidate.id, 'Summer', anomaly.label)
                      }
                    >
                      {busy === leadCandidate.id + 'Summer' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      <UserPlus className="mr-1 h-3 w-3" />
                      Confier à Summer
                    </Button>
                  </>
                )}
              </div>
            </section>
          )}

          {anomaly.kind === 'repeated_no_connect' && (
            <p className="text-sm text-muted-foreground">
              Raison probable : répondeur systématique, numéro erroné, ou prospect
              injoignable. Marquer FAUX NUMERO retire ce numéro du cycle d&apos;appel
              automatique côté n8n.
            </p>
          )}

          {anomaly.kind === 'max_attempts_never_reached' && (
            <p className="text-sm text-muted-foreground">
              Ce lead a épuisé les 3 tentatives prévues et n&apos;a jamais été joint.
              Confier à un humain ou marquer FAUX NUMERO si le numéro paraît
              invalide.
            </p>
          )}

          {anomaly.kind === 'missing_metadata' && (
            <p className="text-sm text-muted-foreground">
              Ces appels ont été passés avant l&apos;activation de
              <code className="font-mono mx-1 text-[11px]">metadata.lead_id</code>
              dans n8n. Ils sont regroupés par téléphone. Quand un lead est trouvé
              par numéro, il est suggéré ci-dessous — il faudra que n8n écrive le
              metadata sur les futurs appels pour les rattacher automatiquement.
            </p>
          )}

          {/* List of calls */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Appels concernés ({calls.length})
            </p>
            {calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun appel.</p>
            ) : (
              <ul className="space-y-2">
                {calls.slice(0, 60).map((c) => {
                  const lvl = callAgentLevel(c)
                  const counterparty = pickCounterpartyNumber(
                    c.direction,
                    c.fromNumber,
                    c.toNumber
                  )
                  const cand =
                    anomaly.kind === 'missing_metadata'
                      ? leadByPhone.get(normalizePhone(counterparty))
                      : undefined
                  return (
                    <li
                      key={c.callId}
                      className="rounded-md border border-border/50 bg-muted/10 p-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <DirectionIcon direction={c.direction} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {lvl ? `Agent ${lvl} · ` : ''}
                              {c.agentName}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {c.startTime
                                ? format(new Date(c.startTime), 'dd/MM HH:mm')
                                : '—'}{' '}
                              · {CRENEAUX[c.creneau].short} · {fmtDur(c.duration)}
                              {' '}
                              <span className="font-mono">{counterparty}</span>
                            </p>
                            {cand && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-blue-400">
                                <Link2 className="h-3 w-3" />
                                Lead candidat : {cand.nom ?? '—'} (BMI{' '}
                                {formatBmi(cand.bmi, '—').text})
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {c.answered ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
                {calls.length > 60 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    + {calls.length - 60} autres
                  </p>
                )}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

