'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, Mail, MessageSquare,
  FileText, Send, Clock, XCircle, ChevronRight, TrendingUp,
} from 'lucide-react'

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
  monthly_target: number
  days_remaining: number
}

function KpiCard({
  label,
  value,
  sub,
  variant = 'default',
  icon: Icon,
}: {
  label: string
  value: number
  sub?: string
  variant?: 'default' | 'blue' | 'amber' | 'green' | 'red' | 'neutral'
  icon?: React.ElementType
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
    <div className={`rounded-xl p-4 shadow-sm ${variants[variant]}`}>
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
        <p className="text-xs text-gray-400 mt-1.5 leading-tight">{sub}</p>
      )}
    </div>
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
  value,
  label,
  sub,
  pct,
}: {
  value: number
  label: string
  sub: string
  pct: number
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 text-center">
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
    </div>
  )
}

export function NhsSuiviPanel() {
  const [stats, setStats] = useState<NhsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchStats = useCallback(async () => {
    setLoading(true)
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
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const submitted = stats?.submitted ?? 0
  const target    = stats?.monthly_target ?? 30
  const progress  = Math.round((submitted / target) * 100)
  const remaining = Math.max(target - submitted, 0)

  const initialEmail = stats?.initial_email_sent ?? 0
  const relanceEmail = stats?.relance_email_sent  ?? 0
  const responses    = stats?.responses_received  ?? 0
  const completeDocs = stats?.complete_docs       ?? 0

  const p = (v: number, base: number) =>
    base > 0 ? Math.round((v / base) * 100) : 0

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Suivi patient NHS S2
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pipeline complet · De l&apos;appel initial à la soumission NHS S2
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Erreur lors du chargement des données : {error}
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
          <div className="rounded-xl p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider opacity-75 mb-1">
                  Objectif mensuel NHS S2
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums">{submitted}</span>
                  <span className="text-xl opacity-60">/ {target}</span>
                </div>
                <p className="text-sm opacity-70 mt-1">
                  dossiers soumis ce mois · {remaining} restant{remaining > 1 ? 's' : ''} à atteindre
                </p>
              </div>
              <div className="w-52 shrink-0">
                <div className="flex justify-between text-xs mb-1.5 opacity-80">
                  <span>Progression</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/90 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs opacity-60 mt-2">
                  {stats.days_remaining} jour{stats.days_remaining > 1 ? 's' : ''} restant{stats.days_remaining > 1 ? 's' : ''} dans le mois
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-4 rounded-xl p-4 bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700">Escalade requise</p>
                <p className="text-xs text-red-500">Patients sans réponse depuis 3 jours+</p>
                <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                  Voir et assigner <ChevronRight className="w-3 h-3" />
                </p>
              </div>
              <span className="text-3xl font-bold text-red-600 tabular-nums shrink-0">
                {stats.no_response_3j}
              </span>
            </div>

            <div className="flex items-center gap-4 rounded-xl p-4 bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700">Prêts à soumettre</p>
                <p className="text-xs text-emerald-600">Dossiers complets — soumission NHS possible</p>
                {stats.bank_exceptions > 0 && (
                  <p className="text-xs text-emerald-500 mt-0.5">
                    dont {stats.bank_exceptions} exception relevés bancaires
                  </p>
                )}
              </div>
              <span className="text-3xl font-bold text-emerald-600 tabular-nums shrink-0">
                {stats.ready_to_submit}
              </span>
            </div>
          </div>

          <div>
            <SectionLabel icon="📧">Communication patient</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Email explicatif envoyé"
                value={stats.initial_email_sent}
                sub="Email initial J0"
                variant="blue"
                icon={Mail}
              />
              <KpiCard
                label="Email relance J+2"
                value={stats.relance_email_sent}
                sub="Relance avec liste des 11 docs"
                variant="amber"
                icon={Mail}
              />
              <KpiCard
                label="WhatsApp relance J+2"
                value={stats.relance_whatsapp_sent}
                sub="Relance en parallèle de l'email"
                variant="amber"
                icon={MessageSquare}
              />
              <KpiCard
                label="Réponses reçues"
                value={stats.responses_received}
                sub={
                  stats.initial_email_sent > 0
                    ? `Taux réponse · ${p(stats.responses_received, stats.initial_email_sent)}%`
                    : 'Patients actifs'
                }
                variant="green"
                icon={TrendingUp}
              />
            </div>
          </div>

          <div>
            <SectionLabel icon="📁">État des dossiers</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Aucun document"
                value={stats.no_docs}
                sub="Relancés — en attente"
                variant="neutral"
                icon={FileText}
              />
              <KpiCard
                label="Documents partiels"
                value={stats.partial_docs}
                sub="Au moins 1 doc reçu"
                variant="amber"
                icon={FileText}
              />
              <KpiCard
                label="Dossiers complets"
                value={stats.complete_docs}
                sub="Prêts pour la NHS →"
                variant="green"
                icon={CheckCircle2}
              />
              <KpiCard
                label="Sans réponse 3j+"
                value={stats.no_response_3j}
                sub="Escalade humaine requise"
                variant="red"
                icon={AlertTriangle}
              />
            </div>
          </div>

          <div>
            <SectionLabel icon="🏥">Suivi NHS S2 (après soumission)</SectionLabel>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Envoyés NHS"
                value={stats.sent_nhs}
                sub="Ce mois en cours"
                variant="blue"
                icon={Send}
              />
              <KpiCard
                label="In review NHS"
                value={stats.in_review}
                sub="En cours d'examen"
                variant="amber"
                icon={Clock}
              />
              <KpiCard
                label="Acceptés NHS"
                value={stats.accepted}
                sub="Prise en charge confirmée"
                variant="green"
                icon={CheckCircle2}
              />
              <KpiCard
                label="Refusés NHS"
                value={stats.refused}
                sub="À analyser"
                variant="red"
                icon={XCircle}
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-5">
              Pipeline de conversion — étapes patient
            </p>
            <div className="flex items-end gap-2">
              <PipelineStep
                value={initialEmail}
                label="Appel initial"
                sub="J0"
                pct={100}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={relanceEmail}
                label="Email relance"
                sub="J+2"
                pct={p(relanceEmail, initialEmail)}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={responses}
                label="Réponse reçue"
                sub="J+2–5"
                pct={p(responses, initialEmail)}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={completeDocs}
                label="Dossier complet"
                sub="J+5–10"
                pct={p(completeDocs, initialEmail)}
              />
              <ChevronRight className="w-4 h-4 text-gray-300 mb-6 shrink-0" />
              <PipelineStep
                value={submitted}
                label="Soumis NHS"
                sub="Dès complet"
                pct={p(submitted, initialEmail)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
