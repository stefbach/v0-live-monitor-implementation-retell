'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatsOverview } from '@/components/dashboard/stats-overview'
import { CallVolumeChart } from '@/components/dashboard/call-volume-chart'
import { SuccessRateChart } from '@/components/dashboard/success-rate-chart'
import { DurationDistribution } from '@/components/dashboard/duration-distribution'
import { PeakHoursHeatmap } from '@/components/dashboard/peak-hours-heatmap'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { CallDetailSheet } from '@/components/dashboard/call-detail-sheet'
import { LiveMonitor } from '@/components/dashboard/live-monitor'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useCalls } from '@/lib/hooks/use-calls'
import type { CallLog } from '@/lib/types'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    calls,
    metrics,
    hourlyData,
    dailyData,
    durationBuckets,
    heatmapData,
    isLoading,
    refresh,
  } = useCalls()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }

  const handleCallSelect = (call: CallLog) => {
    setSelectedCallId(call.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <DashboardHeader onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        {/* Main Content */}
        <main className="mt-6">
          {/* Desktop Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="hidden md:block"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="calls">Call Logs</TabsTrigger>
              <TabsTrigger value="live" className="gap-2">
                Live Monitor
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Stats Cards */}
              <StatsOverview metrics={metrics} isLoading={isLoading} />

              {/* Charts Grid */}
              <div className="grid gap-6 lg:grid-cols-2">
                <CallVolumeChart data={hourlyData} isLoading={isLoading} />
                <SuccessRateChart data={dailyData} isLoading={isLoading} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <DurationDistribution data={durationBuckets} isLoading={isLoading} />
                <PeakHoursHeatmap data={heatmapData} isLoading={isLoading} />
              </div>
            </TabsContent>

            <TabsContent value="calls" className="mt-6">
              <CallLogsTable
                calls={calls}
                isLoading={isLoading}
                onCallSelect={handleCallSelect}
              />
            </TabsContent>

            <TabsContent value="live" className="mt-6">
              <LiveMonitor />
            </TabsContent>
          </Tabs>

          {/* Mobile Content */}
          <div className="md:hidden space-y-6">
            {activeTab === 'overview' && (
              <>
                <StatsOverview metrics={metrics} isLoading={isLoading} />
                <div className="space-y-6">
                  <CallVolumeChart data={hourlyData} isLoading={isLoading} />
                  <SuccessRateChart data={dailyData} isLoading={isLoading} />
                  <DurationDistribution data={durationBuckets} isLoading={isLoading} />
                  <PeakHoursHeatmap data={heatmapData} isLoading={isLoading} />
                </div>
              </>
            )}

            {activeTab === 'calls' && (
              <CallLogsTable
                calls={calls}
                isLoading={isLoading}
                onCallSelect={handleCallSelect}
              />
            )}

            {activeTab === 'live' && <LiveMonitor />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Call Detail Sheet */}
      <CallDetailSheet
        callId={selectedCallId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  )
}
