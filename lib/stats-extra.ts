import type { CallLogEnriched } from './types'
import { getUKParts } from './timezone'

// ─── Activité vs consommation (double axe, par jour UK) ─────────────────────

export interface ActivityPoint {
  date: string // YYYY-MM-DD (UK)
  calls: number
  cost: number // dollars
}

export function activityVsCost(calls: CallLogEnriched[]): ActivityPoint[] {
  const map = new Map<string, { calls: number; cost: number }>()
  for (const c of calls) {
    const p = getUKParts(c.startTime)
    if (!p) continue
    const b = map.get(p.ymd) ?? { calls: 0, cost: 0 }
    b.calls++
    b.cost += (c.cost ?? 0) / 100
    map.set(p.ymd, b)
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, calls: v.calls, cost: Number(v.cost.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
}

// ─── Volume par créneau ─────────────────────────────────────────────────────

export interface CreneauVolume {
  key: string
  label: string
  calls: number
  answered: number
  answerRate: number
}

const CRENEAU_LABEL: Record<string, string> = {
  creneau_1: 'Matin (8-10h)',
  creneau_2: 'Midi (13-14h)',
  creneau_3: 'Soir (18-20h30)',
  hors_creneau: 'Hors créneau',
}

export function creneauVolume(calls: CallLogEnriched[]): CreneauVolume[] {
  const order = ['creneau_1', 'creneau_2', 'creneau_3', 'hors_creneau']
  const map = new Map<string, { calls: number; answered: number }>()
  for (const c of calls) {
    const b = map.get(c.creneau) ?? { calls: 0, answered: 0 }
    b.calls++
    if (c.answered) b.answered++
    map.set(c.creneau, b)
  }
  return order.map((k) => {
    const v = map.get(k) ?? { calls: 0, answered: 0 }
    return {
      key: k,
      label: CRENEAU_LABEL[k],
      calls: v.calls,
      answered: v.answered,
      answerRate: v.calls > 0 ? (v.answered / v.calls) * 100 : 0,
    }
  })
}

// ─── Distribution des durées en secondes (bin configurable) ─────────────────

export interface SecondsBin {
  label: string
  from: number
  count: number
}

export function secondsDistribution(
  calls: CallLogEnriched[],
  binSec: number,
  maxSec = 600
): SecondsBin[] {
  const bins: SecondsBin[] = []
  for (let from = 0; from < maxSec; from += binSec) {
    bins.push({ label: `${from}-${from + binSec}s`, from, count: 0 })
  }
  bins.push({ label: `${maxSec}s+`, from: maxSec, count: 0 })
  for (const c of calls) {
    const d = c.duration
    if (d >= maxSec) {
      bins[bins.length - 1].count++
      continue
    }
    const idx = Math.floor(d / binSec)
    if (idx >= 0 && idx < bins.length) bins[idx].count++
  }
  return bins
}

// ─── Robot awareness + répondeurs non détectés ──────────────────────────────

export interface RobotStats {
  total: number
  known: number // calls where robotAwareness is not null
  robotCount: number
  robotPct: number // % of known
  voicemailSuspectedCount: number
  voicemailSuspectedPct: number // % of all calls
}

export function robotStats(calls: CallLogEnriched[]): RobotStats {
  let known = 0
  let robot = 0
  let vmSus = 0
  for (const c of calls) {
    if (c.robotAwareness !== null && c.robotAwareness !== undefined) {
      known++
      if (c.robotAwareness) robot++
    }
    if (c.voicemailSuspected) vmSus++
  }
  return {
    total: calls.length,
    known,
    robotCount: robot,
    robotPct: known > 0 ? (robot / known) * 100 : 0,
    voicemailSuspectedCount: vmSus,
    voicemailSuspectedPct: calls.length > 0 ? (vmSus / calls.length) * 100 : 0,
  }
}

// ─── Dashboard de fin de soirée (jour UK courant) ───────────────────────────

export interface EndOfDay {
  todayCalls: number
  objective: number
  gap: number // todayCalls - objective
  answeredToday: number
  costToday: number // dollars
  bestCreneau: { label: string; answerRate: number; calls: number } | null
  recommendation: string
}

export function endOfDay(
  allCalls: CallLogEnriched[],
  objective: number,
  now: Date = new Date()
): EndOfDay {
  const todayYmd = getUKParts(now)?.ymd
  const todays = allCalls.filter((c) => getUKParts(c.startTime)?.ymd === todayYmd)
  const answered = todays.filter((c) => c.answered).length
  const cost = todays.reduce((s, c) => s + (c.cost ?? 0), 0) / 100

  const cv = creneauVolume(todays).filter(
    (c) => c.key !== 'hors_creneau' && c.calls >= 3
  )
  const best = [...cv].sort((a, b) => b.answerRate - a.answerRate)[0] ?? null

  let reco = 'Données insuffisantes pour recommander un créneau aujourd’hui.'
  if (best) {
    const when =
      best.key === 'creneau_1'
        ? 'le matin (8h-10h)'
        : best.key === 'creneau_2'
          ? 'le midi (13h-14h)'
          : 'le soir (18h-20h30)'
    reco = `Meilleur taux de réponse ${when} (${best.answerRate.toFixed(
      0
    )}%). Concentrer les prochains appels sur ce créneau.`
  }

  return {
    todayCalls: todays.length,
    objective,
    gap: todays.length - objective,
    answeredToday: answered,
    costToday: Number(cost.toFixed(2)),
    bestCreneau: best
      ? { label: best.label, answerRate: best.answerRate, calls: best.calls }
      : null,
    recommendation: reco,
  }
}
