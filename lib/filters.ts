import type {
  CallLogEnriched,
  DashboardFilters,
  DurationBucketId,
  PeriodId,
  AttemptBucketId,
  EligibilityFilter,
  AnsweredFilter,
} from './types'
import { computeEligibilityFromSummary } from './eligibility'

export const DEFAULT_FILTERS: DashboardFilters = {
  period: '7d',
  customStart: null,
  customEnd: null,
  durations: [],
  qualifications: [],
  sources: [],
  agents: [],
  attempts: [],
  eligibility: 'all',
  answered: 'all',
  search: '',
}

export const DURATION_BUCKETS: { id: DurationBucketId; label: string; test: (s: number) => boolean }[] = [
  { id: 'lt15s', label: '< 15s', test: (s) => s < 15 },
  { id: '15s-1m', label: '15s - 1min', test: (s) => s >= 15 && s < 60 },
  { id: '1-2m', label: '1 - 2min', test: (s) => s >= 60 && s < 120 },
  { id: '2-3m', label: '2 - 3min', test: (s) => s >= 120 && s < 180 },
  { id: '3-5m', label: '3 - 5min', test: (s) => s >= 180 && s < 300 },
  { id: 'gt5m', label: '> 5min', test: (s) => s >= 300 },
]

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7d' },
  { id: '30d', label: 'Last 30d' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
]

// Convert period to [start, end] timestamps (ms)
export function periodRange(
  period: PeriodId,
  customStart: string | null,
  customEnd: string | null,
  now: Date = new Date()
): { start: number; end: number } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = now.getTime()
  switch (period) {
    case 'today':
      return { start: startOfToday, end }
    case 'yesterday':
      return { start: startOfToday - 24 * 60 * 60 * 1000, end: startOfToday }
    case '7d':
      return { start: end - 7 * 24 * 60 * 60 * 1000, end }
    case '30d':
      return { start: end - 30 * 24 * 60 * 60 * 1000, end }
    case 'all':
      return { start: 0, end }
    case 'custom':
      return {
        start: customStart ? new Date(customStart).getTime() : 0,
        end: customEnd ? new Date(customEnd).getTime() : end,
      }
  }
}

// Previous comparable period (same duration, immediately before)
export function previousPeriodRange(
  period: PeriodId,
  customStart: string | null,
  customEnd: string | null,
  now: Date = new Date()
): { start: number; end: number } {
  const cur = periodRange(period, customStart, customEnd, now)
  const span = cur.end - cur.start
  return { start: cur.start - span, end: cur.start }
}

function attemptBucket(n: number): AttemptBucketId {
  if (n <= 1) return '1'
  if (n === 2) return '2'
  return '3plus'
}

export function applyFilters(
  calls: CallLogEnriched[],
  filters: DashboardFilters,
  now: Date = new Date()
): CallLogEnriched[] {
  const { start, end } = periodRange(filters.period, filters.customStart, filters.customEnd, now)
  const durSet = new Set(filters.durations)
  const qSet = new Set(filters.qualifications)
  const srcSet = new Set(filters.sources)
  const agSet = new Set(filters.agents)
  const attSet = new Set(filters.attempts)
  const search = filters.search.trim().toLowerCase()

  return calls.filter((c) => {
    const t = c.startTime ? new Date(c.startTime).getTime() : 0
    if (t < start || t > end) return false

    if (durSet.size > 0) {
      const bucket = DURATION_BUCKETS.find((b) => b.test(c.duration))
      if (!bucket || !durSet.has(bucket.id)) return false
    }

    if (qSet.size > 0 && !qSet.has(c.lead?.qualification ?? '')) return false
    if (srcSet.size > 0 && !srcSet.has(c.lead?.source_lead ?? '')) return false
    if (agSet.size > 0 && !agSet.has(c.agentId)) return false
    if (attSet.size > 0 && !attSet.has(attemptBucket(c.attemptNumber))) return false

    if (filters.answered !== 'all') {
      if (filters.answered === 'answered' && !c.answered) return false
      if (filters.answered === 'no_answer' && c.answered) return false
    }

    if (filters.eligibility !== 'all') {
      const elig = computeEligibilityFromSummary(c.lead)
      if (filters.eligibility === 'eligible' && !elig.eligible) return false
      if (filters.eligibility === 'ineligible' && (elig.eligible || elig.reason === 'unknown'))
        return false
      if (filters.eligibility === 'unknown' && elig.reason !== 'unknown') return false
    }

    if (search) {
      const hay = `${c.agentName} ${c.lead?.nom ?? ''} ${c.lead?.email ?? ''} ${c.fromNumber} ${c.toNumber} ${c.summary ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }

    return true
  })
}

// ─── URL serialization (shareable filter state) ─────────────────────────────

export function filtersToSearchParams(f: DashboardFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.period !== DEFAULT_FILTERS.period) sp.set('period', f.period)
  if (f.customStart) sp.set('start', f.customStart)
  if (f.customEnd) sp.set('end', f.customEnd)
  if (f.durations.length) sp.set('dur', f.durations.join(','))
  if (f.qualifications.length) sp.set('q', f.qualifications.join(','))
  if (f.sources.length) sp.set('src', f.sources.join(','))
  if (f.agents.length) sp.set('ag', f.agents.join(','))
  if (f.attempts.length) sp.set('att', f.attempts.join(','))
  if (f.eligibility !== 'all') sp.set('elig', f.eligibility)
  if (f.answered !== 'all') sp.set('ans', f.answered)
  if (f.search) sp.set('s', f.search)
  return sp
}

export function searchParamsToFilters(sp: URLSearchParams): DashboardFilters {
  const periodVal = sp.get('period') as PeriodId | null
  return {
    period: periodVal ?? DEFAULT_FILTERS.period,
    customStart: sp.get('start'),
    customEnd: sp.get('end'),
    durations: (sp.get('dur')?.split(',').filter(Boolean) ?? []) as DurationBucketId[],
    qualifications: sp.get('q')?.split(',').filter(Boolean) ?? [],
    sources: sp.get('src')?.split(',').filter(Boolean) ?? [],
    agents: sp.get('ag')?.split(',').filter(Boolean) ?? [],
    attempts: (sp.get('att')?.split(',').filter(Boolean) ?? []) as AttemptBucketId[],
    eligibility: (sp.get('elig') as EligibilityFilter | null) ?? 'all',
    answered: (sp.get('ans') as AnsweredFilter | null) ?? 'all',
    search: sp.get('s') ?? '',
  }
}
