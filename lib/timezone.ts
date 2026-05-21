// All time-of-day logic in the dashboard is anchored to UK time
// (Europe/London) because we call UK patients — "when to call" only
// makes sense in the prospect's timezone. Uses Intl (built-in, handles
// BST/GMT automatically), no extra dependency.

const UK_TZ = 'Europe/London'

export interface UKParts {
  year: number
  month: number
  day: number
  hour: number // 0-23
  minute: number
  dayOfWeek: number // 0 = Sunday … 6 = Saturday
  ymd: string // YYYY-MM-DD (UK calendar date)
}

export function getUKParts(input: string | number | Date | null | undefined): UKParts | null {
  if (input == null || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  let hour = Number(get('hour'))
  const minute = Number(get('minute'))
  if (hour === 24) hour = 0 // en-GB renders midnight as 24

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return { year, month, day, hour, minute, dayOfWeek, ymd }
}

// ─── Créneaux d'appel (UK time) ─────────────────────────────────────────────

export type Creneau = 'creneau_1' | 'creneau_2' | 'creneau_3' | 'hors_creneau'

export interface CreneauMeta {
  key: Creneau
  label: string
  short: string
}

export const CRENEAUX: Record<Creneau, CreneauMeta> = {
  creneau_1: { key: 'creneau_1', label: 'Créneau 1 — matin (08h-10h)', short: 'C1 matin' },
  creneau_2: { key: 'creneau_2', label: 'Créneau 2 — midi (13h-14h)', short: 'C2 midi' },
  creneau_3: { key: 'creneau_3', label: 'Créneau 3 — soir (18h-20h30)', short: 'C3 soir' },
  hors_creneau: { key: 'hors_creneau', label: 'Hors créneau', short: 'Hors' },
}

// Créneau 1 = 08:00–09:59, Créneau 2 = 13:00–13:59,
// Créneau 3 = 18:00–20:30, everything else = hors créneau.
export function getCreneau(hour: number, minute: number): Creneau {
  if (hour >= 8 && hour < 10) return 'creneau_1'
  if (hour === 13) return 'creneau_2'
  if ((hour >= 18 && hour < 20) || (hour === 20 && minute <= 30)) return 'creneau_3'
  return 'hors_creneau'
}

export function creneauFromTimestamp(
  input: string | number | Date | null | undefined
): Creneau {
  const p = getUKParts(input)
  if (!p) return 'hors_creneau'
  return getCreneau(p.hour, p.minute)
}
