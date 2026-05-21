'use client'

import { useMemo } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { computeEligibility } from '@/lib/eligibility'
import { formatBmi } from '@/lib/bmi'
import type { Lead } from '@/lib/types'

interface Props {
  leads: Lead[]
  isLoading?: boolean
}

interface EnrichedLead {
  lead: Lead
  bmi: number | null
  reason: string
  comorbidities: string[]
}

export function EligibilityPipeline({ leads, isLoading }: Props) {
  const { hot, lost, total, eligible } = useMemo(() => {
    let eligibleCount = 0
    const hotList: EnrichedLead[] = []
    const lostList: EnrichedLead[] = []
    for (const lead of leads) {
      const e = computeEligibility(lead)
      if (!e.eligible) continue
      eligibleCount++
      const q = lead.qualification ?? 'NOUVEAU DOSSIER'
      if (q === 'PAS INTERESSE' || q === 'FAUX NUMERO') {
        lostList.push({ lead, bmi: e.bmi, reason: e.reason, comorbidities: e.comorbidities })
      } else if (q !== 'RDV MEDECIN') {
        hotList.push({ lead, bmi: e.bmi, reason: e.reason, comorbidities: e.comorbidities })
      }
    }
    hotList.sort((a, b) => (b.bmi ?? 0) - (a.bmi ?? 0))
    lostList.sort((a, b) => (b.bmi ?? 0) - (a.bmi ?? 0))
    return { hot: hotList, lost: lostList, total: leads.length, eligible: eligibleCount }
  }, [leads])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility pipeline</CardTitle>
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Eligibility pipeline (S2 UK NHS WMP)
            </CardTitle>
            <CardDescription>
              BMI ≥ 40, or BMI ≥ 35 with a qualifying comorbidity
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            {eligible.toLocaleString()} eligible · {total.toLocaleString()} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hot list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">
              🎯 Eligible & still in pipeline ({hot.length.toLocaleString()})
            </p>
          </div>
          {hot.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No eligible leads waiting — pipeline is empty.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Patient</th>
                    <th className="pb-2 font-medium text-right">BMI</th>
                    <th className="pb-2 font-medium">Comorbidities</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Calls</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {hot.slice(0, 12).map(({ lead, bmi, comorbidities }) => (
                    <tr key={lead.id} className="border-b border-border/40">
                      <td className="py-2 truncate max-w-[160px]">
                        <div className="font-medium">{lead.nom ?? 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {lead.numero_telephone ?? ''}
                        </div>
                      </td>
                      <td
                        className="py-2 text-right font-mono text-emerald-500 font-semibold"
                        title={
                          formatBmi(bmi).valid
                            ? ''
                            : `Valeur DB brute : ${bmi ?? 'null'}`
                        }
                      >
                        {formatBmi(bmi, '—').text}
                      </td>
                      <td className="py-2 text-xs">
                        {comorbidities.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {comorbidities.slice(0, 3).map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px]">
                                {c}
                              </Badge>
                            ))}
                            {comorbidities.length > 3 && (
                              <span className="text-muted-foreground">+{comorbidities.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">BMI ≥ 40</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {lead.qualification ?? 'NOUVEAU DOSSIER'}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {lead.call_count ?? 0}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                        {lead.source_lead ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hot.length > 12 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  + {(hot.length - 12).toLocaleString()} more — refine filters to see them.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lost list */}
        {lost.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Eligible but lost ({lost.length.toLocaleString()}) — review reasons
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {lost.slice(0, 8).map(({ lead, bmi }) => (
                <Badge key={lead.id} variant="outline" className="font-normal">
                  {lead.nom ?? 'Unknown'} · BMI {formatBmi(bmi, '—').text} ·{' '}
                  <span className="text-amber-500">{lead.qualification}</span>
                </Badge>
              ))}
              {lost.length > 8 && (
                <span className="text-muted-foreground">+{lost.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
