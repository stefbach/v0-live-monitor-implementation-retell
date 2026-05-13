'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { BusinessKpis } from '@/components/dashboard/business-kpis'
import { CallHeatmap } from '@/components/dashboard/call-heatmap'
import { CostAdvanced } from '@/components/dashboard/cost-advanced'
import { ConversionFunnel } from '@/components/dashboard/conversion-funnel'
import { QualificationBreakdown } from '@/components/dashboard/qualification-breakdown'
import { SourceAttribution } from '@/components/dashboard/source-attribution'
import { AttemptFunnel } from '@/components/dashboard/attempt-funnel'
import { AgentChain } from '@/components/dashboard/agent-chain'
import { EligibilityPipeline } from '@/components/dashboard/eligibility-pipeline'
import { DurationHistogram } from '@/components/dashboard/duration-histogram'
import { VerbatimPanel } from '@/components/dashboard/verbatim-panel'
import { AgentPerformance } from '@/components/dashboard/agent-performance'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { CallDetailSheet } from '@/components/dashboard/call-detail-sheet'
import { LiveMonitor } from '@/components/dashboard/live-monitor'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useDashboardData } from '@/lib/hooks/use-calls'
import type { CallLogEnriched } from '@/lib/types'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    allCalls,
    filteredCalls,
    leads,
    agentNames,
    callMetrics,
    businessMetrics,
    isLoading,
    refresh,
  } = useDashboardData()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }

  const handleCallSelect = (call: CallLogEnriched) => {
    setSelectedCallId(call.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DashboardHeader onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        <main className="mt-6 space-y-6">
          {/* Persistent global filter bar — visible on all tabs */}
          <FilterBar calls={allCalls} agentNames={agentNames} />

          {/* Desktop Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
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
              <BusinessKpis
                metrics={callMetrics}
                business={businessMetrics}
                filteredCalls={filteredCalls}
                allCalls={allCalls}
                leads={leads}
                isLoading={isLoading}
              />

              <CallHeatmap calls={filteredCalls} isLoading={isLoading} />

              <CostAdvanced
                allCalls={allCalls}
                filteredCalls={filteredCalls}
                isLoading={isLoading}
              />

              <div className="grid gap-6 lg:grid-cols-3">
                <ConversionFunnel
                  funnel={businessMetrics?.funnel ?? null}
                  isLoading={isLoading}
                />
                <QualificationBreakdown
                  data={businessMetrics?.qualifications ?? []}
                  isLoading={isLoading}
                />
                <SourceAttribution
                  data={businessMetrics?.sources ?? []}
                  isLoading={isLoading}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <AttemptFunnel calls={filteredCalls} isLoading={isLoading} />
                <AgentChain
                  calls={filteredCalls}
                  agentNames={agentNames}
                  isLoading={isLoading}
                />
              </div>

              <EligibilityPipeline leads={leads} isLoading={isLoading} />

              <div className="grid gap-6 lg:grid-cols-2">
                <DurationHistogram calls={filteredCalls} isLoading={isLoading} />
                <VerbatimPanel calls={filteredCalls} isLoading={isLoading} />
              </div>

              <AgentPerformance
                agents={businessMetrics?.agents ?? []}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="calls" className="mt-6">
              <CallLogsTable
                calls={filteredCalls}
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
                <BusinessKpis
                  metrics={callMetrics}
                  business={businessMetrics}
                  filteredCalls={filteredCalls}
                  allCalls={allCalls}
                  leads={leads}
                  isLoading={isLoading}
                />
                <CallHeatmap calls={filteredCalls} isLoading={isLoading} />
                <CostAdvanced
                  allCalls={allCalls}
                  filteredCalls={filteredCalls}
                  isLoading={isLoading}
                />
                <ConversionFunnel
                  funnel={businessMetrics?.funnel ?? null}
                  isLoading={isLoading}
                />
                <QualificationBreakdown
                  data={businessMetrics?.qualifications ?? []}
                  isLoading={isLoading}
                />
                <SourceAttribution
                  data={businessMetrics?.sources ?? []}
                  isLoading={isLoading}
                />
                <AttemptFunnel calls={filteredCalls} isLoading={isLoading} />
                <AgentChain
                  calls={filteredCalls}
                  agentNames={agentNames}
                  isLoading={isLoading}
                />
                <EligibilityPipeline leads={leads} isLoading={isLoading} />
                <DurationHistogram calls={filteredCalls} isLoading={isLoading} />
                <VerbatimPanel calls={filteredCalls} isLoading={isLoading} />
                <AgentPerformance
                  agents={businessMetrics?.agents ?? []}
                  isLoading={isLoading}
                />
              </>
            )}

            {activeTab === 'calls' && (
              <CallLogsTable
                calls={filteredCalls}
                isLoading={isLoading}
                onCallSelect={handleCallSelect}
              />
            )}

            {activeTab === 'live' && <LiveMonitor />}
          </div>
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <CallDetailSheet
        callId={selectedCallId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  )
}
