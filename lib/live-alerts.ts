import type { CallLogEnriched } from './types'
import { qualKeyFromRaw } from './qualifications'

// ─── Terminal-style recent feed ─────────────────────────────────────────────

export interface FeedLine {
  callId: string
  time: string // HH:MM:SS
  name: string
  qualification: string
  qualKey: string
  duration: number
  agent: string
}

export function recentFeed(calls: CallLogEnriched[], limit = 40): FeedLine[] {
  return [...calls]
    .filter((c) => c.startTime)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit)
    .map((c) => {
      const d = new Date(c.startTime)
      return {
        callId: c.callId,
        time: `${String(d.getHours()).padStart(2, '0')}:${String(
          d.getMinutes()
        ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
        name: c.lead?.nom ?? 'Inconnu',
        qualification: c.lead?.qualification ?? '—',
        qualKey: qualKeyFromRaw(c.lead?.qualification),
        duration: c.duration,
        agent: c.agentName,
      }
    })
}

// ─── Real-time alerts ───────────────────────────────────────────────────────

export type AlertLevel = 'rouge' | 'orange' | 'jaune'

export interface LiveAlert {
  callId: string
  level: AlertLevel
  label: string
  name: string
  time: string
}

export function computeLiveAlerts(
  calls: CallLogEnriched[],
  limit = 30
): LiveAlert[] {
  const recent = [...calls]
    .filter((c) => c.startTime)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 150)

  const alerts: LiveAlert[] = []
  for (const c of recent) {
    const d = new Date(c.startTime)
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`
    const name = c.lead?.nom ?? 'Inconnu'
    if (c.robotAwareness === true) {
      alerts.push({ callId: c.callId, level: 'rouge', label: 'Robot awareness détecté', name, time })
    } else if (c.voicemailSuspected) {
      alerts.push({ callId: c.callId, level: 'orange', label: 'Répondeur non détecté', name, time })
    } else if (c.duration > 0 && c.duration < 10) {
      alerts.push({ callId: c.callId, level: 'jaune', label: `Appel anormalement court (${c.duration}s)`, name, time })
    }
  }
  return alerts.slice(0, limit)
}

// ─── Erreurs & Alertes : sections dérivées ──────────────────────────────────

export interface RepondeurLead {
  callId: string
  leadId: string | null
  name: string | null
  phone: string | null
  duration: number
  time: string
  inVoicemail: boolean
  direction: 'inbound' | 'outbound'
}

export function computeRepondeurs(calls: CallLogEnriched[]): RepondeurLead[] {
  return calls
    .filter((c) => c.inVoicemail || c.voicemailSuspected)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .map((c) => ({
      callId: c.callId,
      leadId: c.meta?.leadId ?? c.lead?.id ?? null,
      name: c.lead?.nom ?? null,
      phone: c.lead?.numero_telephone ?? c.toNumber ?? null,
      duration: c.duration,
      time: c.startTime,
      inVoicemail: !!c.inVoicemail,
      direction: c.direction,
    }))
}

export interface RobotLead {
  callId: string
  leadId: string | null
  name: string | null
  phone: string | null
  time: string
  direction: 'inbound' | 'outbound'
}

export function computeRobotLeads(calls: CallLogEnriched[]): RobotLead[] {
  return calls
    .filter((c) => c.robotAwareness === true)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .map((c) => ({
      callId: c.callId,
      leadId: c.meta?.leadId ?? c.lead?.id ?? null,
      name: c.lead?.nom ?? null,
      phone: c.lead?.numero_telephone ?? c.toNumber ?? null,
      time: c.startTime,
      direction: c.direction,
    }))
}

export interface Anomaly {
  kind:
    | 'repeated_no_connect'
    | 'max_attempts_never_reached'
    | 'missing_metadata'
  key: string
  label: string
  detail: string
  count: number
}

export function computeAnomalies(calls: CallLogEnriched[]): Anomaly[] {
  const out: Anomaly[] = []

  // Repeated non-connected calls on the same number
  const byNumber = new Map<string, { total: number; answered: number }>()
  for (const c of calls) {
    const num = c.toNumber || c.fromNumber
    if (!num) continue
    const b = byNumber.get(num) ?? { total: 0, answered: 0 }
    b.total++
    if (c.answered) b.answered++
    byNumber.set(num, b)
  }
  for (const [num, b] of byNumber.entries()) {
    if (b.total >= 3 && b.answered === 0) {
      out.push({
        kind: 'repeated_no_connect',
        key: num,
        label: `Numéro jamais joint`,
        detail: `${num} — ${b.total} appels, 0 décroché`,
        count: b.total,
      })
    }
  }

  // Leads with jN_attempts = 3 and never reached
  const byLead = new Map<
    string,
    { name: string | null; answered: boolean; maxAttempts: number }
  >()
  for (const c of calls) {
    const k = c.meta?.leadId ?? c.lead?.id
    if (!k) continue
    const att = Math.max(
      c.meta?.j1Attempts ?? 0,
      c.meta?.j3Attempts ?? 0,
      c.meta?.j5Attempts ?? 0
    )
    const b = byLead.get(k) ?? {
      name: c.lead?.nom ?? null,
      answered: false,
      maxAttempts: 0,
    }
    b.answered = b.answered || c.answered
    b.maxAttempts = Math.max(b.maxAttempts, att)
    byLead.set(k, b)
  }
  for (const [k, b] of byLead.entries()) {
    if (b.maxAttempts >= 3 && !b.answered) {
      out.push({
        kind: 'max_attempts_never_reached',
        key: k,
        label: '3 tentatives sans contact',
        detail: `${b.name ?? 'Lead'} — ${b.maxAttempts} tentatives, jamais joint`,
        count: b.maxAttempts,
      })
    }
  }

  // Calls without metadata.lead_id (placed before the n8n metadata
  // rollout) — surfaced so they're easy to identify. They are still
  // grouped via phone fallback but worth flagging.
  const noMeta = calls.filter((c) => !c.meta?.leadId)
  if (noMeta.length > 0) {
    out.push({
      kind: 'missing_metadata',
      key: 'missing_metadata',
      label: 'Appels sans metadata',
      detail: `${noMeta.length} appels sans metadata.lead_id (regroupés par téléphone). Ex: ${noMeta
        .slice(0, 3)
        .map((c) => c.callId.slice(0, 12))
        .join(', ')}`,
      count: noMeta.length,
    })
  }

  return out.sort((a, b) => b.count - a.count)
}
