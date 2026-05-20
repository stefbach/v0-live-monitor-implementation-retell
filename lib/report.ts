import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CallLogEnriched, Lead, DashboardFilters } from './types'
import { computeConfirmedRdvLeads } from './rdv'
import { leadGroupKey } from './lead-key'
import { qualKeyFromRaw, QUAL_META, QUALIFICATION_CARDS } from './qualifications'
import { computeHeatmap } from './analytics'
import { periodRange, PERIODS } from './filters'
import { getUKParts } from './timezone'

export type Frequency = 'daily' | 'weekly'
export type Format = 'pdf' | 'csv'

interface ReportRow {
  period: string // human readable
  totalCalls: number
  answered: number
  answerRate: number
  rdvConfirmed: number
  conversionRate: number
  costDollars: number
  bestSlot: string
}

interface ReportData {
  periodLabel: string
  rows: ReportRow[]
  totals: {
    totalCalls: number
    answered: number
    answerRate: number
    rdvConfirmed: number
    conversionRate: number
    costDollars: number
  }
  qualification: { label: string; count: number; percent: number }[]
  bestSlotOverall: string
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function fmtPeriodLabel(filters: DashboardFilters): string {
  const item = PERIODS.find((p) => p.id === filters.period)
  if (filters.period === 'custom' && filters.customStart && filters.customEnd) {
    return `${filters.customStart} → ${filters.customEnd}`
  }
  return item?.label ?? filters.period
}

function bestSlotLabel(calls: CallLogEnriched[]): string {
  const cells = computeHeatmap(calls)
  const top = [...cells]
    .filter((c) => c.total >= 3)
    .sort((a, b) => b.answerRate - a.answerRate)[0]
  if (!top) return '—'
  return `${DAYS_FR[top.dayOfWeek]} ${top.hour}h (${top.answerRate.toFixed(0)}%)`
}

function bucketDaily(date: Date): string {
  const p = getUKParts(date)
  return p?.ymd ?? ''
}

function bucketWeekly(date: Date): string {
  const p = getUKParts(date)
  if (!p) return ''
  // ISO week label YYYY-Www
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function buildReportData(args: {
  allCalls: CallLogEnriched[]
  leads: Lead[]
  filters: DashboardFilters
  frequency: Frequency
}): ReportData {
  const { allCalls, filters, frequency } = args
  const { start, end } = periodRange(
    filters.period,
    filters.customStart,
    filters.customEnd
  )
  const inPeriod = allCalls.filter((c) => {
    const t = c.startTime ? new Date(c.startTime).getTime() : 0
    return t >= start && t <= end
  })

  // Group by bucket
  const bucketFn = frequency === 'daily' ? bucketDaily : bucketWeekly
  const groups = new Map<string, CallLogEnriched[]>()
  for (const c of inPeriod) {
    const key = bucketFn(new Date(c.startTime))
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  // Confirmed across the entire period (lead-level)
  const confirmedInPeriod = computeConfirmedRdvLeads(inPeriod)

  const rows: ReportRow[] = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, calls]) => {
      const total = calls.length
      const answered = calls.filter((c) => c.answered).length
      // RDV at the bucket scope: confirmed leads whose chain has a call in the bucket
      const bucketConfirmed = computeConfirmedRdvLeads(calls)
      const rdv = bucketConfirmed.size
      const cost = calls.reduce((s, c) => s + (c.cost ?? 0), 0) / 100
      return {
        period: periodKey,
        totalCalls: total,
        answered,
        answerRate: total > 0 ? (answered / total) * 100 : 0,
        rdvConfirmed: rdv,
        conversionRate: answered > 0 ? (rdv / answered) * 100 : 0,
        costDollars: Number(cost.toFixed(2)),
        bestSlot: bestSlotLabel(calls),
      }
    })

  // Totals across the whole period
  const total = inPeriod.length
  const answered = inPeriod.filter((c) => c.answered).length
  const cost = inPeriod.reduce((s, c) => s + (c.cost ?? 0), 0) / 100
  const totals = {
    totalCalls: total,
    answered,
    answerRate: total > 0 ? (answered / total) * 100 : 0,
    rdvConfirmed: confirmedInPeriod.size,
    conversionRate:
      answered > 0 ? (confirmedInPeriod.size / answered) * 100 : 0,
    costDollars: Number(cost.toFixed(2)),
  }

  // Qualification breakdown (distinct leads, like the dashboard)
  const seen = new Map<string, CallLogEnriched>()
  for (const c of inPeriod) {
    const k = leadGroupKey(c)
    if (!k) continue
    const prev = seen.get(k)
    if (
      !prev ||
      new Date(c.startTime).getTime() > new Date(prev.startTime).getTime()
    ) {
      seen.set(k, c)
    }
  }
  const counts: Record<string, number> = {}
  for (const [id, c] of seen.entries()) {
    let key = qualKeyFromRaw(c.lead?.qualification)
    if (key === 'rdv_confirme' && !confirmedInPeriod.has(id)) key = 'autre'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const leadsTotal = Object.values(counts).reduce((s, n) => s + n, 0)
  const qualification = [...QUALIFICATION_CARDS, 'autre' as const]
    .map((k) => ({
      label: QUAL_META[k].label,
      count: counts[k] ?? 0,
      percent: leadsTotal > 0 ? ((counts[k] ?? 0) / leadsTotal) * 100 : 0,
    }))
    .filter((q) => q.count > 0)

  return {
    periodLabel: fmtPeriodLabel(filters),
    rows,
    totals,
    qualification,
    bestSlotOverall: bestSlotLabel(inPeriod),
  }
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export function generatePdf(data: ReportData, frequency: Frequency): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const now = new Date()
  const generatedAt = now.toLocaleString('fr-FR')

  // Header
  doc.setFontSize(18)
  doc.setTextColor(91, 107, 191) // OCC blue
  doc.text('OCC — Rapport d\'activité', 40, 50)

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Période : ${data.periodLabel}`, 40, 70)
  doc.text(
    `Fréquence : ${frequency === 'daily' ? 'Journalière' : 'Hebdomadaire'}`,
    40,
    85
  )
  doc.text(`Généré le ${generatedAt}`, 40, 100)

  // KPI summary table
  autoTable(doc, {
    startY: 120,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Total appels', data.totals.totalCalls.toLocaleString('fr-FR')],
      [
        'Appels décrochés',
        `${data.totals.answered.toLocaleString('fr-FR')} (${data.totals.answerRate.toFixed(1)}%)`,
      ],
      ['RDV confirmés', data.totals.rdvConfirmed.toLocaleString('fr-FR')],
      ['Taux de conversion (RDV / décrochés)', `${data.totals.conversionRate.toFixed(1)}%`],
      [
        'Coût total',
        `$${data.totals.costDollars.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      ['Meilleur créneau (période)', data.bestSlotOverall],
    ],
    theme: 'striped',
    headStyles: { fillColor: [91, 107, 191] },
    styles: { fontSize: 10 },
  })

  // Qualification breakdown
  if (data.qualification.length > 0) {
    const cursorY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY
    doc.setFontSize(12)
    doc.setTextColor(91, 107, 191)
    doc.text('Répartition par qualification', 40, cursorY + 24)
    autoTable(doc, {
      startY: cursorY + 32,
      head: [['Qualification', 'Leads', '%']],
      body: data.qualification.map((q) => [
        q.label,
        q.count.toLocaleString('fr-FR'),
        `${q.percent.toFixed(1)}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [91, 107, 191] },
      styles: { fontSize: 10 },
    })
  }

  // Per-bucket breakdown
  if (data.rows.length > 0) {
    const cursorY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY
    doc.setFontSize(12)
    doc.setTextColor(91, 107, 191)
    doc.text(
      `Détail ${frequency === 'daily' ? 'journalier' : 'hebdomadaire'}`,
      40,
      cursorY + 24
    )
    autoTable(doc, {
      startY: cursorY + 32,
      head: [
        [
          frequency === 'daily' ? 'Jour' : 'Semaine',
          'Appels',
          'Décrochés',
          'Tx déc.',
          'RDV',
          'Conv.',
          'Coût $',
          'Meilleur créneau',
        ],
      ],
      body: data.rows.map((r) => [
        r.period,
        r.totalCalls.toLocaleString('fr-FR'),
        r.answered.toLocaleString('fr-FR'),
        `${r.answerRate.toFixed(0)}%`,
        r.rdvConfirmed.toLocaleString('fr-FR'),
        `${r.conversionRate.toFixed(0)}%`,
        `$${r.costDollars.toFixed(2)}`,
        r.bestSlot,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [91, 107, 191] },
      styles: { fontSize: 9 },
    })
  }

  return doc.output('blob')
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function escapeCsv(v: string | number): string {
  const s = String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function generateCsv(data: ReportData, frequency: Frequency): Blob {
  const lines: string[] = []
  lines.push('OCC — Rapport d\'activité')
  lines.push(`Période;${data.periodLabel}`)
  lines.push(`Fréquence;${frequency === 'daily' ? 'Journalière' : 'Hebdomadaire'}`)
  lines.push(`Généré le;${new Date().toLocaleString('fr-FR')}`)
  lines.push('')
  lines.push('Indicateur;Valeur')
  lines.push(`Total appels;${data.totals.totalCalls}`)
  lines.push(`Appels décrochés;${data.totals.answered}`)
  lines.push(`Taux de décroché;${data.totals.answerRate.toFixed(1)}%`)
  lines.push(`RDV confirmés;${data.totals.rdvConfirmed}`)
  lines.push(`Taux de conversion;${data.totals.conversionRate.toFixed(1)}%`)
  lines.push(`Coût total ($);${data.totals.costDollars.toFixed(2)}`)
  lines.push(`Meilleur créneau;${escapeCsv(data.bestSlotOverall)}`)
  lines.push('')

  lines.push('Qualification;Leads;Pourcentage')
  for (const q of data.qualification) {
    lines.push(`${escapeCsv(q.label)};${q.count};${q.percent.toFixed(1)}%`)
  }
  lines.push('')

  lines.push(
    [
      frequency === 'daily' ? 'Jour' : 'Semaine',
      'Appels',
      'Décrochés',
      'Tx décroché',
      'RDV',
      'Conversion',
      'Coût $',
      'Meilleur créneau',
    ].join(';')
  )
  for (const r of data.rows) {
    lines.push(
      [
        r.period,
        r.totalCalls,
        r.answered,
        `${r.answerRate.toFixed(1)}%`,
        r.rdvConfirmed,
        `${r.conversionRate.toFixed(1)}%`,
        `$${r.costDollars.toFixed(2)}`,
        escapeCsv(r.bestSlot),
      ].join(';')
    )
  }

  // BOM for Excel UTF-8 compatibility
  return new Blob(['﻿' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
}

// ─── Download helpers ───────────────────────────────────────────────────────

export function reportFilename(args: {
  periodLabel: string
  frequency: Frequency
  format: Format
}): string {
  const safePeriod = args.periodLabel
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `OCC_Rapport_${safePeriod}_${stamp}.${args.format}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
