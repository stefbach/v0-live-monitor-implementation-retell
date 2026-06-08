'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, Mail, MessageSquare,
  FileText, Send, Clock, XCircle, ChevronRight, TrendingUp,
  ArrowLeft, Search, Phone, AtSign, Calendar, Hourglass, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/hooks/use-t'

// How often the live NHS dashboard re-fetches while the tab is visible (ms).
// Keeps the panel in sync with workflow writes (dossier status, documents,
// communications) in near real time without a manual refresh.
const LIVE_REFRESH_MS = 15_000

// ── Types ──────────────────────────────────────────────────────────────────

interface NhsStats {
  initial_email_sent: number
  initial_whatsapp_sent: number
  relance_email_sent: number
  relance_whatsapp_sent: number
  responses_received: number
  no_response_3j: number
  no_docs: number
  partial_docs: number
  complete_docs: number
  ready_to_submit: number
  submitted: number
  sent_nhs: number
  in_review: number
  additional_info: number
  accepted: number
  refused: number
  bank_exceptions: number
  clinic_s2_provider: number
  clinic_medical_report: number
  clinic_undue_delay: number
  clinic_estimate: number
  monthly_target: number
  days_remaining: number
  // Time dimension (aging / SLA / cycle time / pace)
  on_pace_target: number
  pace_per_day: number
  stalled_count: number
  stalled_oldest_days: number
  partial_oldest_days: number
  complete_oldest_days: number
  avg_days_to_submit: number | null
  in_review_avg_days: number | null
  in_review_over_sla: number
  in_review_sla_days: number
}

type PatientStatus = 'complets' | 'partiels' | 'sans-reponse' | 'aucun-doc' | 'envoye-nhs'

// List filters: the patient statuses, plus a synthetic "no-response" bucket that
// spans everyone contacted who has not replied yet (broader than 3-day escalation).
type ListFilter = PatientStatus | 'all' | 'no-response'

interface NhsPatient {
  id: string
  lead_id: string
  name: string | null
  initials: string
  age: number | null
  email: string | null
  phone: string | null
  status: PatientStatus
  docs_received: number
  docs_required: number
  last_activity: string | null
  nhs_status: string | null
  escalade: boolean
  no_response: boolean
  bank_exception: boolean
}

interface NhsPatientDetail {
  patient: NhsPatient
  documents: Array<{ key: string; required: boolean; origin: 'patient' | 'signature' | 'clinic'; received: boolean }>
  timeline: Array<{
    party: 'patient' | 'clinic' | 'nhs' | 'team'
    kind: 'call' | 'email' | 'whatsapp' | 'doc' | 'response' | 'submission' | 'assignment'
    date: string | null
    title_key: string
    name: string | null
    detail: string | null
    count: number
  }>
}

type View =
  | { name: 'dashboard' }
  | { name: 'list'; filter: ListFilter }
  | { name: 'detail'; id: string; from: ListFilter }

// ── Shared bits ────────────────────────────────────────────────────────────

const statusBadgeClass: Record<PatientStatus, string> = {
  complets:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  partiels:      'bg-amber-50 text-amber-700 border-amber-200',
  'sans-reponse':'bg-red-50 text-red-700 border-red-200',
  'aucun-doc':   'bg-gray-50 text-gray-700 border-gray-200',
  'envoye-nhs':  'bg-blue-50 text-blue-700 border-blue-200',
}

const nhsStatusBadgeClass: Record<string, string> = {
  in_review:       'bg-amber-50 text-amber-700 border-amber-200',
  additional_info: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  refused:         'bg-red-50 text-red-700 border-red-200',
}

// Communications history: each entry is colour-coded by counterparty (who the
// communication was with) and by channel (the dot).
// Distinct, accessible party colours (blue / teal / indigo / amber) — paired
// with a text label everywhere, so meaning never rests on colour alone.
const commPartyChip: Record<'patient' | 'clinic' | 'nhs' | 'team', string> = {
  patient: 'bg-blue-50 text-blue-700',
  clinic:  'bg-teal-50 text-teal-700',
  nhs:     'bg-indigo-50 text-indigo-700',
  team:    'bg-amber-50 text-amber-700',
}
const commPartyDot: Record<'patient' | 'clinic' | 'nhs' | 'team', string> = {
  patient: 'bg-blue-500',
  clinic:  'bg-teal-500',
  nhs:     'bg-indigo-500',
  team:    'bg-amber-500',
}
// Document checklist status styling. Signature docs (clinic-produced, sent out
// for signature) use "Awaiting signature → Signed" rather than the patient
// document "Pending → Received" wording.
const docStatusStyle: Record<string, { tag: string; icon: string; glyph: string }> = {
  received:          { tag: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-100 text-emerald-700', glyph: '✓' },
  signed:            { tag: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-100 text-emerald-700', glyph: '✓' },
  pending:           { tag: 'bg-gray-100 text-gray-600',      icon: 'bg-gray-200 text-gray-500',        glyph: '·' },
  awaitingSignature: { tag: 'bg-blue-50 text-blue-700',       icon: 'bg-blue-100 text-blue-700',        glyph: '✎' },
  optional:          { tag: 'bg-amber-50 text-amber-700',     icon: 'bg-amber-100 text-amber-700',      glyph: '○' },
}

// Channel icon + party colour for each communications-history row.
const commKindIcon: Record<string, React.ElementType> = {
  call:       Phone,
  email:      Mail,
  whatsapp:   MessageSquare,
  doc:        FileText,
  response:   CheckCircle2,
  submission: Send,
  assignment: User,
}
const commPartyText: Record<'patient' | 'clinic' | 'nhs' | 'team', string> = {
  patient: 'text-blue-500',
  clinic:  'text-teal-500',
  nhs:     'text-indigo-500',
  team:    'text-amber-500',
}
const COMM_PARTIES = ['patient', 'clinic', 'nhs', 'team'] as const

function KpiCard({
  label, value, sub, subTone = 'default', variant = 'default', icon: Icon, onClick,
}: {
  label: string
  value: number
  sub?: string
  subTone?: 'default' | 'warn'
  variant?: 'default' | 'blue' | 'amber' | 'green' | 'red' | 'neutral'
  icon?: React.ElementType
  onClick?: () => void
}) {
  const variants = {
    default: 'bg-white border border-gray-200',
    blue:    'bg-white border-l-4 border-l-blue-400 border border-gray-200',
    amber:   'bg-white border-l-4 border-l-amber-400 border border-gray-200',
    green:   'bg-white border-l-4 border-l-emerald-400 border border-gray-200',
    red:     'bg-white border-l-4 border-l-red-400 border border-gray-200',
    neutral: 'bg-white border-l-4 border-l-gray-300 border border-gray-200',
  }
  const valueColors = {
    default: 'text-gray-900',
    blue:    'text-blue-600',
    amber:   'text-amber-600',
    green:   'text-emerald-600',
    red:     'text-red-600',
    neutral: 'text-gray-600',
  }
  return (
    <button
      onClick={onClick}
      type="button"
      className={`text-left w-full rounded-xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${variants[variant]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">
          {label}
        </p>
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5" />}
      </div>
      <p className={`text-3xl font-semibold tabular-nums ${valueColors[variant]}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1.5 leading-tight ${subTone === 'warn' ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
    </button>
  )
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {children}
      </span>
    </div>
  )
}

function PipelineStep({
  value, label, sub, pct, onClick,
}: { value: number; label: string; sub: string; pct: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 text-center rounded-lg p-2 hover:bg-blue-50 transition-colors"
    >
      <div className="text-xl font-semibold tabular-nums text-gray-800">{value}</div>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="text-xs text-gray-400">{sub}</div>
      <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
        <div
          className="bg-blue-500 h-1 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="text-xs text-blue-500 font-medium">{pct}%</div>
    </button>
  )
}

function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; onClick?: () => void }>
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
            {isLast || !item.onClick ? (
              <span className="text-gray-500">{item.label}</span>
            ) : (
              <button
                onClick={item.onClick}
                className="text-blue-600 hover:underline font-medium"
              >
                {item.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ── Patient actions ────────────────────────────────────────────────────────
// The three quick actions (email reminder, WhatsApp reminder, NHS submission)
// each POST to /api/nhs-patients/:id/action, which forwards to an n8n webhook
// server-side. The send/write-back is owned by n8n; the dashboard just triggers
// it and re-fetches so the panel reflects whatever the workflow wrote.

type PatientActionName = 'relance-email' | 'relance-whatsapp' | 'submit-nhs'

const ACTION_TOAST_KEY: Record<PatientActionName, string> = {
  'relance-email': 'nhs.toast.relanceEmail',
  'relance-whatsapp': 'nhs.toast.relanceWhatsapp',
  'submit-nhs': 'nhs.toast.submit',
}

async function postPatientAction(
  id: string,
  action: PatientActionName,
): Promise<{ simulated: boolean }> {
  const res = await fetch(`/api/nhs-patients/${encodeURIComponent(id)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    simulated?: boolean
    error?: string
  }
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return { simulated: !!data.simulated }
}

// Runs an action and surfaces the outcome as a toast. Returns true on success so
// the caller can refresh. A "simulated" result (no n8n webhook configured yet) is
// flagged so test-mode clicks aren't mistaken for real sends.
async function runPatientAction(
  id: string,
  action: PatientActionName,
  t: (k: string) => string,
): Promise<boolean> {
  try {
    const { simulated } = await postPatientAction(id, action)
    toast.success(
      t(ACTION_TOAST_KEY[action]),
      simulated ? { description: t('nhs.toast.simulated') } : undefined,
    )
    return true
  } catch (e) {
    toast.error(t('nhs.toast.error'), {
      description: e instanceof Error ? e.message : String(e),
    })
    return false
  }
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function NhsSuiviPanel() {
  const { t, lang } = useT()
  const [view, setView] = useState<View>({ name: 'dashboard' })

  return (
    <div className="space-y-6 pb-8">
      {view.name === 'dashboard' && (
        <DashboardView
          t={t}
          lang={lang}
          onOpenList={(filter) => setView({ name: 'list', filter })}
        />
      )}
      {view.name === 'list' && (
        <ListView
          t={t}
          lang={lang}
          filter={view.filter}
          onBack={() => setView({ name: 'dashboard' })}
          onChangeFilter={(filter) => setView({ name: 'list', filter })}
          onOpenPatient={(id) => setView({ name: 'detail', id, from: view.filter })}
        />
      )}
      {view.name === 'detail' && (
        <DetailView
          t={t}
          lang={lang}
          id={view.id}
          fromFilter={view.from}
          onBackDashboard={() => setView({ name: 'dashboard' })}
          onBackList={() => setView({ name: 'list', filter: view.from })}
        />
      )}
    </div>
  )
}

// ── View 1: Dashboard ──────────────────────────────────────────────────────

function DashboardView({
  t, lang, onOpenList,
}: {
  t: (k: string) => string
  lang: 'fr' | 'en'
  onOpenList: (filter: ListFilter) => void
}) {
  const [stats, setStats] = useState<NhsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchStats = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nhs-stats', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: NhsStats = await res.json()
      setStats(data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  // Live updates: poll while the tab is visible and refetch on focus, so the
  // panel reflects workflow writes in near real time. Background polls are
  // silent (no spinner / skeleton flash); the manual button stays explicit.
  useEffect(() => {
    fetchStats()
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats({ silent: true })
    }, LIVE_REFRESH_MS)
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchStats({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetchStats])

  const submitted = stats?.submitted ?? 0
  const target    = stats?.monthly_target ?? 30
  const progress  = Math.round((submitted / target) * 100)
  const remaining = Math.max(target - submitted, 0)

  const initialEmail = stats?.initial_email_sent ?? 0
  const relanceEmail = stats?.relance_email_sent  ?? 0
  const responses    = stats?.responses_received  ?? 0
  const completeDocs = stats?.complete_docs       ?? 0

  // Pace to the monthly target: where you should be by today vs where you are.
  const onPaceTarget = stats?.on_pace_target ?? 0
  const pacePerDay   = stats?.pace_per_day ?? 0
  const behindPace   = submitted < onPaceTarget
  const onPacePct    = target > 0 ? Math.round((onPaceTarget / target) * 100) : 0

  const p = (v: number, base: number) =>
    base > 0 ? Math.round((v / base) * 100) : 0
  const plural = (key: string, n: number) =>
    t(`${key}.${n > 1 ? 'other' : 'one'}`)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <>
      <Breadcrumb items={[{ label: t('nhs.breadcrumb.overview') }]} />

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('nhs.title')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('nhs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2" title="Live · auto-refresh">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {t('nhs.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {t('nhs.error')} : {error}
        </div>
      )}

      {loading && !stats && (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <>
          {/* Objectif mensuel */}
          <div className="rounded-xl p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider opacity-75 mb-1">
                  {t('nhs.objective.title')}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums">{submitted}</span>
                  <span className="text-xl opacity-60">/ {target}</span>
                </div>
                <p className="text-sm opacity-80 mt-1">
                  {t('nhs.objective.submittedThisMonth')} · {remaining}{' '}
                  {plural('nhs.objective.remainingToReach', remaining)}
                  <span className="mx-1.5 opacity-50">•</span>
                  <span className="font-semibold">
                    {t('nhs.objective.needPerDay').replace('{n}', String(pacePerDay))}
                  </span>
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/15 text-[11px] font-medium align-middle">
                    {behindPace
                      ? `▼ ${t('nhs.objective.behindPace')}`
                      : `▲ ${t('nhs.objective.onPaceLabel')}`}
                  </span>
                </p>
              </div>
              <div className="w-52 shrink-0">
                <div className="flex justify-between text-xs mb-1.5 opacity-80">
                  <span>{t('nhs.objective.progress')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/90 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                {/* On-pace marker: where the count should be by today */}
                <div className="relative h-3.5">
                  <div
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${Math.min(onPacePct, 100)}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="w-0.5 h-2 bg-amber-300" />
                    <span className="text-[10px] text-amber-200 whitespace-nowrap">
                      {t('nhs.objective.onPace').replace('{n}', String(onPaceTarget))}
                    </span>
                  </div>
                </div>
                <p className="text-xs opacity-60">
                  {stats.days_remaining} {plural('nhs.objective.daysRemaining', stats.days_remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* Alertes — stacked vertically */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onOpenList('sans-reponse')}
              className="w-full flex items-center gap-4 rounded-xl p-4 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700">{t('nhs.alert.escalation.title')}</p>
                <p className="text-xs text-red-500">{t('nhs.alert.escalation.desc')}</p>
                <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                  {t('nhs.alert.escalation.cta')} <ChevronRight className="w-3 h-3" />
                </p>
              </div>
              <span className="text-3xl font-bold text-red-600 tabular-nums shrink-0">
                {stats.no_response_3j}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenList('complets')}
              className="w-full flex items-center gap-4 rounded-xl p-4 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700">{t('nhs.alert.ready.title')}</p>
                <p className="text-xs text-emerald-600">{t('nhs.alert.ready.desc')}</p>
                {stats.bank_exceptions > 0 && (
                  <p className="text-xs text-emerald-500 mt-0.5">
                    {t('nhs.alert.ready.bankExceptionTpl').replace('{n}', String(stats.bank_exceptions))}
                  </p>
                )}
              </div>
              <span className="text-3xl font-bold text-emerald-600 tabular-nums shrink-0">
                {stats.ready_to_submit}
              </span>
            </button>

            {/* Aging / SLA — partial dossiers that have gone quiet */}
            <button
              type="button"
              onClick={() => onOpenList('partiels')}
              className="w-full flex items-center gap-4 rounded-xl p-4 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                  {t('nhs.alert.stalled.title')}
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1 py-px rounded">SLA</span>
                </p>
                <p className="text-xs text-amber-600">
                  {stats.stalled_count > 0
                    ? t('nhs.alert.stalled.desc').replace('{n}', String(stats.stalled_oldest_days))
                    : t('nhs.alert.stalled.descEmpty')}
                </p>
              </div>
              <span className="text-3xl font-bold text-amber-600 tabular-nums shrink-0">
                {stats.stalled_count}
              </span>
            </button>
          </div>

          {/* Communication */}
          <div>
            <SectionLabel icon="📧">{t('nhs.section.communication')}</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label={t('nhs.comm.initialEmail.label')}
                value={stats.initial_email_sent}
                sub={t('nhs.comm.initialEmail.sub')}
                variant="blue"
                icon={Mail}
                onClick={() => onOpenList('all')}
              />
              <KpiCard
                label={t('nhs.comm.relanceEmail.label')}
                value={stats.relance_email_sent}
                sub={t('nhs.comm.relanceEmail.sub')}
                variant="amber"
                icon={Mail}
                onClick={() => onOpenList('all')}
              />
              <KpiCard
                label={t('nhs.comm.relanceWhatsapp.label')}
                value={stats.relance_whatsapp_sent}
                sub={t('nhs.comm.relanceWhatsapp.sub')}
                variant="amber"
                icon={MessageSquare}
                onClick={() => onOpenList('all')}
              />
              <KpiCard
                label={t('nhs.comm.responses.label')}
                value={stats.responses_received}
                sub={
                  stats.initial_email_sent > 0
                    ? t('nhs.comm.responses.rateTpl').replace(
                        '{n}',
                        String(p(stats.responses_received, stats.initial_email_sent)),
                      )
                    : t('nhs.comm.responses.active')
                }
                variant="green"
                icon={TrendingUp}
                onClick={() => onOpenList('all')}
              />
            </div>
          </div>

          {/* Dossiers */}
          <div>
            <SectionLabel icon="📁">{t('nhs.section.dossiers')}</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label={t('nhs.dossier.none.label')}
                value={stats.no_docs}
                sub={t('nhs.dossier.none.sub')}
                variant="neutral"
                icon={FileText}
                onClick={() => onOpenList('aucun-doc')}
              />
              <KpiCard
                label={t('nhs.dossier.partial.label')}
                value={stats.partial_docs}
                sub={
                  stats.partial_oldest_days > 0
                    ? t('nhs.dossier.partial.aging').replace('{n}', String(stats.partial_oldest_days))
                    : t('nhs.dossier.partial.sub')
                }
                subTone={stats.partial_oldest_days > 0 ? 'warn' : 'default'}
                variant="amber"
                icon={FileText}
                onClick={() => onOpenList('partiels')}
              />
              <KpiCard
                label={t('nhs.dossier.complete.label')}
                value={stats.complete_docs}
                sub={
                  stats.complete_oldest_days > 0
                    ? t('nhs.dossier.complete.aging').replace('{n}', String(stats.complete_oldest_days))
                    : t('nhs.dossier.complete.sub')
                }
                variant="green"
                icon={CheckCircle2}
                onClick={() => onOpenList('complets')}
              />
              <KpiCard
                label={t('nhs.dossier.noResponse.label')}
                value={stats.no_response_3j}
                sub={t('nhs.dossier.noResponse.sub')}
                variant="red"
                icon={AlertTriangle}
                onClick={() => onOpenList('sans-reponse')}
              />
            </div>
          </div>

          {/* Clinic documents — produced / signed by the clinic */}
          <div>
            <SectionLabel icon="🩺">{t('nhs.section.clinicDocs')}</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label={t('nhs.clinic.medicalReport.label')}
                value={stats.clinic_medical_report}
                sub={t('nhs.clinic.medicalReport.sub')}
                variant="blue"
                icon={FileText}
              />
              <KpiCard
                label={t('nhs.clinic.undueDelay.label')}
                value={stats.clinic_undue_delay}
                sub={t('nhs.clinic.undueDelay.sub')}
                variant="blue"
                icon={FileText}
              />
              <KpiCard
                label={t('nhs.clinic.s2Provider.label')}
                value={stats.clinic_s2_provider}
                sub={t('nhs.clinic.s2Provider.sub')}
                variant="amber"
                icon={Send}
              />
              <KpiCard
                label={t('nhs.clinic.estimate.label')}
                value={stats.clinic_estimate}
                sub={t('nhs.clinic.estimate.sub')}
                variant="amber"
                icon={FileText}
              />
            </div>
          </div>

          {/* NHS tracking */}
          <div>
            <SectionLabel icon="🏥">{t('nhs.section.nhsTracking')}</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label={t('nhs.tracking.sent.label')}
                value={stats.sent_nhs}
                sub={
                  stats.avg_days_to_submit != null
                    ? t('nhs.tracking.sent.cycle').replace('{n}', String(stats.avg_days_to_submit))
                    : t('nhs.tracking.sent.sub')
                }
                variant="blue"
                icon={Send}
                onClick={() => onOpenList('envoye-nhs')}
              />
              <KpiCard
                label={t('nhs.tracking.inReview.label')}
                value={stats.in_review}
                sub={
                  stats.in_review > 0 && stats.in_review_avg_days != null
                    ? t('nhs.tracking.inReview.aging').replace('{n}', String(stats.in_review_avg_days)) +
                      (stats.in_review_over_sla > 0
                        ? ' · ' +
                          t('nhs.tracking.inReview.overSla')
                            .replace('{m}', String(stats.in_review_over_sla))
                            .replace('{sla}', String(stats.in_review_sla_days))
                        : '')
                    : t('nhs.tracking.inReview.sub')
                }
                subTone={stats.in_review_over_sla > 0 ? 'warn' : 'default'}
                variant="amber"
                icon={Clock}
                onClick={() => onOpenList('envoye-nhs')}
              />
              <KpiCard
                label={t('nhs.tracking.accepted.label')}
                value={stats.accepted}
                sub={t('nhs.tracking.accepted.sub')}
                variant="green"
                icon={CheckCircle2}
                onClick={() => onOpenList('envoye-nhs')}
              />
              <KpiCard
                label={t('nhs.tracking.refused.label')}
                value={stats.refused}
                sub={t('nhs.tracking.refused.sub')}
                variant="red"
                icon={XCircle}
                onClick={() => onOpenList('envoye-nhs')}
              />
            </div>
          </div>

          {/* Pipeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-5">
              {t('nhs.section.pipeline')}
            </p>
            <div className="flex items-end gap-2">
              <PipelineStep
                value={initialEmail}
                label={t('nhs.pipeline.step.initial.label')}
                sub={t('nhs.pipeline.step.initial.sub')}
                pct={100}
                onClick={() => onOpenList('all')}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={relanceEmail}
                label={t('nhs.pipeline.step.relance.label')}
                sub={t('nhs.pipeline.step.relance.sub')}
                pct={p(relanceEmail, initialEmail)}
                onClick={() => onOpenList('all')}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={responses}
                label={t('nhs.pipeline.step.response.label')}
                sub={t('nhs.pipeline.step.response.sub')}
                pct={p(responses, initialEmail)}
                onClick={() => onOpenList('all')}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={completeDocs}
                label={t('nhs.pipeline.step.complete.label')}
                sub={t('nhs.pipeline.step.complete.sub')}
                pct={p(completeDocs, initialEmail)}
                onClick={() => onOpenList('complets')}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={submitted}
                label={t('nhs.pipeline.step.submitted.label')}
                sub={t('nhs.pipeline.step.submitted.sub')}
                pct={p(submitted, initialEmail)}
                onClick={() => onOpenList('envoye-nhs')}
              />
            </div>
            {stats.avg_days_to_submit != null && (
              <p className="text-[11px] text-gray-500 mt-4 border-t border-gray-100 pt-2.5">
                {t('nhs.pipeline.cycle').replace('{n}', String(stats.avg_days_to_submit))}
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ── View 2: Patient list ───────────────────────────────────────────────────

function ListView({
  t, lang, filter, onBack, onChangeFilter, onOpenPatient,
}: {
  t: (k: string) => string
  lang: 'fr' | 'en'
  filter: ListFilter
  onBack: () => void
  onChangeFilter: (f: ListFilter) => void
  onOpenPatient: (id: string) => void
}) {
  const [patients, setPatients] = useState<NhsPatient[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchPatients = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/nhs-patients', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = (await r.json()) as { patients: NhsPatient[] }
      setPatients(d.patients)
    } catch (e) {
      setError(String(e))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients()
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') fetchPatients({ silent: true })
    }, LIVE_REFRESH_MS)
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchPatients({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetchPatients])

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const [submittingId, setSubmittingId] = useState<string | null>(null)
  async function handleSubmit(p: NhsPatient) {
    if (submittingId) return
    setSubmittingId(p.id)
    const ok = await runPatientAction(p.id, 'submit-nhs', t)
    setSubmittingId(null)
    if (ok) fetchPatients({ silent: true })
  }

  const filtered = (patients ?? []).filter(p => {
    if (filter === 'no-response') {
      if (!p.no_response) return false
    } else if (filter !== 'all' && p.status !== filter) {
      return false
    }
    if (search) {
      const s = search.toLowerCase()
      const hay = `${p.name ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`.toLowerCase()
      if (!hay.includes(s)) return false
    }
    return true
  })

  const filterButtons: Array<{ id: ListFilter; key: string }> = [
    { id: 'all',          key: 'nhs.list.filter.all' },
    { id: 'no-response',  key: 'nhs.list.filter.escalation' },
    { id: 'partiels',     key: 'nhs.list.filter.partial' },
    { id: 'complets',     key: 'nhs.list.filter.complete' },
    { id: 'envoye-nhs',   key: 'nhs.list.filter.sent' },
  ]

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('nhs.breadcrumb.overview'), onClick: onBack },
          { label: t(`nhs.list.filterLabel.${filter === 'all' ? 'all' : filter}`) },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('nhs.list.title')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('nhs.list.subtitle')}</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          {t('nhs.back')}
        </button>
      </div>

      {/* Filter chips + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map(b => {
          const active = filter === b.id
          return (
            <button
              key={b.id}
              onClick={() => onChangeFilter(b.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t(b.key)}
            </button>
          )
        })}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('nhs.list.search')}
            className="pl-7 pr-3 py-1.5 text-xs rounded-full border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {t('nhs.error')} : {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.patient')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.status')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.documents')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.lastActivity')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.nhsStatus')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('nhs.list.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">{t('common.loading')}</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">{t('nhs.list.empty')}</td></tr>
            )}
            {filtered.map(p => {
              const pct = p.docs_required > 0
                ? Math.round((p.docs_received / p.docs_required) * 100)
                : 0
              const fillCls =
                p.status === 'complets' ? 'bg-emerald-500'
                : pct < 50 ? 'bg-red-400'
                : 'bg-amber-400'
              const lastActivity = p.last_activity
                ? new Date(p.last_activity).toLocaleString(locale, {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })
                : '—'
              const nhsKey = p.nhs_status ? `nhs.badge.${p.nhs_status}` : null
              return (
                <tr
                  key={p.id}
                  onClick={() => onOpenPatient(p.id)}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center shrink-0">
                        {p.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">
                          {p.age != null ? `${p.age} ${t('nhs.list.years')}` : ''}
                          {p.phone ? `${p.age != null ? ' · ' : ''}${p.phone}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadgeClass[p.status]}`}>
                      {t(`nhs.badge.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fillCls}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 tabular-nums">
                        {p.docs_received}/{p.docs_required}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{lastActivity}</td>
                  <td className="px-4 py-3">
                    {nhsKey ? (
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${nhsStatusBadgeClass[p.nhs_status!] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {t(nhsKey)}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {p.escalade && (
                        <button
                          onClick={() => onOpenPatient(p.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        >
                          {t('nhs.list.action.escalation')}
                        </button>
                      )}
                      {p.status === 'complets' && (
                        <button
                          type="button"
                          onClick={() => handleSubmit(p)}
                          disabled={submittingId === p.id}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingId === p.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {t('nhs.list.action.submit')}
                        </button>
                      )}
                      <button
                        onClick={() => onOpenPatient(p.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {t('nhs.list.action.view')} →
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── View 3: Patient detail ─────────────────────────────────────────────────

function DetailView({
  t, lang, id, fromFilter, onBackDashboard, onBackList,
}: {
  t: (k: string) => string
  lang: 'fr' | 'en'
  id: string
  fromFilter: ListFilter
  onBackDashboard: () => void
  onBackList: () => void
}) {
  const [detail, setDetail] = useState<NhsPatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PatientActionName | null>(null)
  const [commFilter, setCommFilter] = useState<'all' | 'patient' | 'clinic' | 'nhs' | 'team'>('all')

  const fetchDetail = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/nhs-patients/${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = (await r.json()) as NhsPatientDetail
      setDetail(d)
    } catch (e) {
      setError(String(e))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchDetail({ silent: true })
    }, LIVE_REFRESH_MS)
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchDetail({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetchDetail])

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  if (loading || !detail) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: t('nhs.breadcrumb.overview'), onClick: onBackDashboard },
            { label: t(`nhs.list.filterLabel.${fromFilter === 'all' ? 'all' : fromFilter}`), onClick: onBackList },
            { label: '…' },
          ]}
        />
        {error
          ? <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{t('nhs.error')} : {error}</div>
          : <div className="text-sm text-gray-400">{t('nhs.detail.loading')}</div>}
      </>
    )
  }

  const { patient, documents, timeline } = detail

  // Journey step states
  const journey: Array<{ key: string; done: boolean; active: boolean }> = [
    { key: 'call',     done: !!patient.last_activity,           active: false },
    { key: 'email',    done: patient.status !== 'aucun-doc' || timeline.some(t => t.kind === 'email'), active: false },
    { key: 'relance',  done: timeline.some(t => t.title_key === 'nhs.detail.timeline.relanceEmail'),    active: false },
    { key: 'docs',     done: patient.docs_received >= patient.docs_required, active: patient.status === 'partiels' || patient.status === 'aucun-doc' },
    { key: 'complete', done: patient.status === 'complets' || patient.status === 'envoye-nhs',         active: patient.status === 'complets' },
    { key: 'sent',     done: patient.status === 'envoye-nhs', active: patient.status === 'envoye-nhs' && !patient.nhs_status },
  ]

  const docPct = patient.docs_required > 0
    ? Math.round((patient.docs_received / patient.docs_required) * 100)
    : 0
  const docComplete = patient.docs_received >= patient.docs_required

  async function handleAction(action: PatientActionName) {
    if (pendingAction) return
    setPendingAction(action)
    const ok = await runPatientAction(id, action, t)
    setPendingAction(null)
    if (ok) fetchDetail({ silent: true })
  }

  // Communications history: filter by party, then group by calendar day so the
  // log reads as a dated feed (time only on each row). `timeline` is already
  // sorted newest-first, so same-day entries are adjacent.
  const filteredComms =
    commFilter === 'all' ? timeline : timeline.filter(e => e.party === commFilter)
  const commGroups: Array<{ key: string; label: string; items: typeof timeline }> = []
  for (const item of filteredComms) {
    const key = item.date
      ? new Date(item.date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : '__earlier__'
    const label = item.date
      ? new Date(item.date).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
      : t('nhs.detail.comms.earlier')
    const last = commGroups[commGroups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else commGroups.push({ key, label, items: [item] })
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('nhs.breadcrumb.overview'), onClick: onBackDashboard },
          { label: t(`nhs.list.filterLabel.${fromFilter === 'all' ? 'all' : fromFilter}`), onClick: onBackList },
          { label: patient.name ?? '—' },
        ]}
      />

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 text-blue-700 text-xl font-semibold flex items-center justify-center shrink-0">
            {patient.initials}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{patient.name ?? '—'}</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
              {patient.age != null && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" /> {patient.age} {t('nhs.detail.years')}
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${statusBadgeClass[patient.status]}`}>
            {t(`nhs.badge.${patient.status}`)}
          </span>
          {patient.last_activity && (
            <span className="text-xs text-gray-400 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(patient.last_activity).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Journey */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          {t('nhs.detail.journey.title')}
        </p>
        <div className="flex items-start gap-0">
          {journey.map((step, i) => {
            const dotCls = step.done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : step.active
                ? 'bg-white border-amber-400 ring-4 ring-amber-50 text-amber-600'
                : 'bg-gray-50 border-gray-300 text-gray-400'
            const lineCls = step.done ? 'bg-emerald-400' : 'bg-gray-200'
            const labelCls = step.done ? 'text-emerald-700 font-semibold' : 'text-gray-500'
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center relative">
                {i < journey.length - 1 && (
                  <div className={`absolute top-3.5 left-1/2 right-[-50%] h-0.5 ${lineCls}`} />
                )}
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold relative z-10 ${dotCls}`}>
                  {step.done ? '✓' : step.active ? <Hourglass className="w-3 h-3" /> : ''}
                </div>
                <div className={`text-[11px] text-center mt-2 ${labelCls}`}>
                  {t(`nhs.detail.journey.${step.key}`)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

        {/* Documents checklist */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            {t('nhs.detail.docs.title')}
          </p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${docComplete ? 'bg-emerald-500' : docPct < 50 ? 'bg-red-400' : 'bg-amber-400'}`}
                style={{ width: `${docPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 tabular-nums">
              {t('nhs.detail.docs.requiredCount')
                .replace('{n}', String(patient.docs_received))
                .replace('{total}', String(patient.docs_required))}
            </span>
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
              docComplete
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {docComplete ? t('nhs.detail.docs.statusComplete') : t('nhs.detail.docs.statusIncomplete')}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {documents.map(doc => {
              // Signature docs (e.g. S2 Provider Declaration, Detailed Medical
              // Estimate) aren't received from the patient — the clinic sends them
              // out for signature and gets them back, so show that workflow's
              // status. For patient docs, reflect the real received state first so
              // an optional doc that arrived (bank statements) shows "Received".
              const status =
                doc.origin === 'signature'
                  ? doc.received ? 'signed' : 'awaitingSignature'
                  : doc.received ? 'received' : doc.required ? 'pending' : 'optional'
              const s = docStatusStyle[status]
              return (
                <div key={doc.key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-gray-50">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${s.icon}`}>
                    {s.glyph}
                  </div>
                  <span className="flex-1 text-xs text-gray-700">{t(`nhs.doc.${doc.key}`)}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.tag}`}>
                    {t(`nhs.detail.docs.${status}`)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Communications history */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('nhs.detail.comms.title')}
            </p>
            {filteredComms.length > 0 && (
              <span className="text-[11px] text-gray-400 tabular-nums">{filteredComms.length}</span>
            )}
          </div>

          {/* Filter chips — also act as the party colour legend */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setCommFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                commFilter === 'all'
                  ? 'border-gray-300 bg-gray-100 text-gray-900'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t('nhs.detail.comms.all')}
            </button>
            {COMM_PARTIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setCommFilter(p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                  commFilter === p
                    ? 'border-gray-300 bg-gray-100 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${commPartyDot[p]}`} />
                {t(`nhs.detail.comms.party.${p}`)}
              </button>
            ))}
          </div>

          {timeline.length === 0 ? (
            <p className="text-xs text-gray-400">{t('nhs.detail.comms.empty')}</p>
          ) : filteredComms.length === 0 ? (
            <p className="text-xs text-gray-400">{t('nhs.detail.comms.emptyFilter')}</p>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto -mr-2 pr-2">
              {commGroups.map((group, gi) => (
                <div key={group.key} className={gi > 0 ? 'mt-3' : ''}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    {group.label}
                  </div>
                  {group.items.map((item, i) => {
                    const Icon = commKindIcon[item.kind] ?? FileText
                    const primary = item.title_key
                      ? t(item.title_key).replace('{name}', item.name ?? '')
                      : item.name ?? ''
                    const countSuffix = item.count > 1 ? ` ×${item.count}` : ''
                    const tooltip = `${primary}${countSuffix}${item.detail ? ' · ' + item.detail : ''}`
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 text-xs"
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${commPartyText[item.party]}`} />
                        <span className="shrink-0 w-[44px] text-gray-400 tabular-nums">
                          {item.date
                            ? new Date(item.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                        <div className="flex-1 min-w-0 truncate" title={tooltip}>
                          <span className="font-medium text-gray-700">{primary}{countSuffix}</span>
                          {item.detail && <span className="text-gray-400">{' · '}{item.detail}</span>}
                        </div>
                        <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${commPartyChip[item.party]}`}>
                          {t(`nhs.detail.comms.party.${item.party}`)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

      {/* NHS S2 status pipeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          {t('nhs.detail.nhsStatus.title')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(['envoye-nhs', 'in_review', 'additional_info', 'accepted', 'refused'] as const).map(s => {
            const isActive = patient.nhs_status === s ||
              (s === 'envoye-nhs' && patient.status === 'envoye-nhs')
            return (
              <span
                key={s}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                  isActive
                    ? (nhsStatusBadgeClass[s] ?? 'bg-blue-50 text-blue-700 border-blue-200')
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
              >
                {t(`nhs.badge.${s}`)}
              </span>
            )
          })}
        </div>
        {patient.status !== 'envoye-nhs' && (
          <p className="text-xs text-gray-400 mt-3">{t('nhs.detail.nhsStatus.notSubmitted')}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          {t('nhs.detail.actions.title')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleAction('relance-email')}
            disabled={pendingAction !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === 'relance-email'
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Mail className="w-3 h-3" />}
            {t('nhs.detail.actions.relanceEmail')}
          </button>
          <button
            type="button"
            onClick={() => handleAction('relance-whatsapp')}
            disabled={pendingAction !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === 'relance-whatsapp'
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <MessageSquare className="w-3 h-3" />}
            {t('nhs.detail.actions.relanceWhatsapp')}
          </button>
          <button
            type="button"
            onClick={() => handleAction('submit-nhs')}
            disabled={!docComplete || pendingAction !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingAction === 'submit-nhs'
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Send className="w-3 h-3" />}
            {t('nhs.detail.actions.submit')}
          </button>
        </div>
      </div>

      {/* Escalation */}
      {patient.escalade && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700">{t('nhs.detail.escalation.title')}</p>
          <p className="text-xs text-red-600 mt-1 mb-3">{t('nhs.detail.escalation.desc')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-1.5">
              <User className="w-3 h-3" /> {t('nhs.detail.escalation.assignRain')}
            </button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-1.5">
              <User className="w-3 h-3" /> {t('nhs.detail.escalation.assignSummer')}
            </button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-red-700 border border-red-200 hover:bg-red-100">
              {t('nhs.detail.escalation.note')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
