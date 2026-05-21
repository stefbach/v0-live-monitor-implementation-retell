'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Bot,
  Voicemail,
  Target,
  DollarSign,
  Sun,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  activityVsCost,
  creneauVolume,
  secondsDistribution,
  endOfDay,
} from '@/lib/stats-extra'
import { useDashboardErrors } from '@/lib/hooks/use-dashboard'
import type { CallLogEnriched } from '@/lib/types'

interface Props {
  allCalls: CallLogEnriched[]
  filteredCalls: CallLogEnriched[]
  isLoading?: boolean
}

const cfg: ChartConfig = {
  calls: { label: 'Appels', color: 'hsl(217, 91%, 60%)' },
  cost: { label: 'Coût $', color: 'hsl(38, 92%, 50%)' },
  count: { label: 'Appels', color: 'hsl(217, 91%, 60%)' },
}

export function StatsExtras({ allCalls, filteredCalls, isLoading }: Props) {
  const [bin, setBin] = useState(15)
  const [objective, setObjective] = useState(200)

  const activity = useMemo(() => activityVsCost(filteredCalls), [filteredCalls])
  const creneaux = useMemo(() => creneauVolume(filteredCalls), [filteredCalls])
  const secs = useMemo(
    () => secondsDistribution(filteredCalls, bin),
    [filteredCalls, bin]
  )
  const { errors: dashboardErrors } = useDashboardErrors()
  const { persistedRobot, persistedVoicemail, analyzedInPeriod } = useMemo(() => {
    const filteredIds = new Set(filteredCalls.map((c) => c.callId))
    let robot = 0
    let vm = 0
    const analyzed = new Set<string>()
    for (const e of dashboardErrors) {
      if (!e.call_id || !filteredIds.has(e.call_id)) continue
      if (e.error_type === 'robot_awareness') robot++
      if (e.error_type === 'voicemail_suspected') vm++
      analyzed.add(e.call_id)
    }
    return {
      persistedRobot: robot,
      persistedVoicemail: vm,
      analyzedInPeriod: analyzed.size,
    }
  }, [dashboardErrors, filteredCalls])
  const eod = useMemo(
    () => endOfDay(allCalls, objective),
    [allCalls, objective]
  )

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />
  }

  return (
    <div className="space-y-6">
      {/* Activité vs consommation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activité vs consommation Retell</CardTitle>
          <CardDescription>Volume d&apos;appels et coût par jour (UK)</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune donnée.
            </p>
          ) : (
            <ChartContainer config={cfg} className="h-[220px] w-full">
              <ComposedChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={44}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  yAxisId="left"
                  dataKey="calls"
                  fill="hsl(217, 91%, 60%)"
                  radius={[2, 2, 0, 0]}
                  opacity={0.7}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(38, 92%, 50%)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volume par créneau */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Volume par créneau horaire</CardTitle>
            <CardDescription>Appels et taux de réponse · heure UK</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[200px] w-full">
              <BarChart data={creneaux}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="calls" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="answered" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {creneaux.map((c) => (
                <span key={c.key}>
                  {c.label}: <strong>{c.calls}</strong> ·{' '}
                  <span className="text-emerald-500">{c.answerRate.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Distribution durées en secondes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Distribution des durées</CardTitle>
                <CardDescription>Par tranche de {bin}s</CardDescription>
              </div>
              <div className="flex gap-1">
                {[10, 15, 30, 60].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBin(b)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      bin === b
                        ? 'bg-primary text-primary-foreground'
                        : 'border hover:bg-muted'
                    }`}
                  >
                    {b}s
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[200px] w-full">
              <BarChart data={secs}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(271, 91%, 65%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Robot awareness + répondeurs (persistant via dashboard_errors) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={Bot}
          color="bg-red-500/10 text-red-400"
          label="Robot awareness détectés"
          value={persistedRobot.toLocaleString()}
          sub={`sur la période filtrée · ${
            filteredCalls.length > 0
              ? ((persistedRobot / filteredCalls.length) * 100).toFixed(1)
              : '0.0'
          }%`}
        />
        <StatTile
          icon={Voicemail}
          color="bg-amber-500/10 text-amber-500"
          label="Répondeurs non détectés"
          value={persistedVoicemail.toLocaleString()}
          sub={`${
            filteredCalls.length > 0
              ? ((persistedVoicemail / filteredCalls.length) * 100).toFixed(1)
              : '0.0'
          }% des appels`}
        />
        <StatTile
          icon={TrendingUp}
          color="bg-blue-500/10 text-blue-500"
          label="Analyse au clic"
          value={`${analyzedInPeriod}`}
          sub={`appels déjà ouverts en détail sur la période`}
        />
      </div>

      {/* Dashboard fin de soirée */}
      <Card className="ring-1 ring-violet-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-amber-500" />
            Dashboard de fin de soirée
          </CardTitle>
          <CardDescription>Bilan du jour (heure UK) et recommandation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={Target}
              color="bg-blue-500/10 text-blue-500"
              label="Appels aujourd'hui"
              value={eod.todayCalls.toLocaleString()}
              sub={`${eod.answeredToday} décrochés`}
            />
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">Objectif / écart</p>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  value={objective}
                  min={1}
                  onChange={(e) =>
                    setObjective(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-8 w-20"
                />
                <span
                  className={`text-sm font-semibold ${
                    eod.gap >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {eod.gap >= 0 ? '+' : ''}
                  {eod.gap}
                </span>
              </div>
            </div>
            <StatTile
              icon={DollarSign}
              color="bg-amber-500/10 text-amber-500"
              label="Coût du jour"
              value={`$${eod.costToday.toFixed(2)}`}
            />
            <StatTile
              icon={Sun}
              color="bg-emerald-500/10 text-emerald-500"
              label="Meilleur créneau"
              value={eod.bestCreneau ? eod.bestCreneau.label : '—'}
              sub={
                eod.bestCreneau
                  ? `${eod.bestCreneau.answerRate.toFixed(0)}% de réponse`
                  : 'données insuffisantes'
              }
            />
          </div>
          <div className="rounded-md border border-violet-500/30 bg-violet-950/5 p-3">
            <p className="text-sm">
              <span className="font-semibold text-violet-400">💡 Recommandation : </span>
              {eod.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Bot
  color: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="text-base font-semibold">{value}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}
