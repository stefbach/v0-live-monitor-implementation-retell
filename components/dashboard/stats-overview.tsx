'use client'

import { Phone, CheckCircle, Clock, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { CallMetrics } from '@/lib/types'

interface StatsOverviewProps {
  metrics: CallMetrics | null
  isLoading?: boolean
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function StatsOverview({ metrics, isLoading }: StatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="py-4">
            <CardContent className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: 'Total Calls',
      value: metrics?.totalCalls.toLocaleString() ?? '0',
      icon: Phone,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Success Rate',
      value: `${metrics?.successRate.toFixed(1) ?? '0'}%`,
      icon: CheckCircle,
      color: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(metrics?.averageDuration ?? 0),
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      label: 'Active Now',
      value: metrics?.activeCalls.toString() ?? '0',
      icon: Activity,
      color: 'bg-rose-500/10 text-rose-500',
      pulse: (metrics?.activeCalls ?? 0) > 0,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="py-4">
          <CardContent className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold">{stat.value}</p>
                {stat.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
