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
import { AgentPerformance } from '@/components/dashboard/agent-performance'
import { InsightsPanel } from '@/components/dashboard/ai-insights/insights-panel'
import { DirectorView } from '@/components/dashboard/director/director-view'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { CallLogsFilters } from '@/components/dashboard/call-logs-filters'
import { StatsExtras } from '@/components/dashboard/stats/stats-extras'
import { ReportButton } from '@/components/dashboard/report-button'
import { CallDetailSheet } from '@/components/dashboard/call-detail-sheet'
import { LiveView } from '@/components/dashboard/live/live-view'
import { ErrorsView } from '@/components/dashboard/errors/errors-view'
import { InboundCallsPanel } from '@/components/dashboard/inbound-calls-panel'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useDashboardData } from '@/lib/hooks/use-calls'
import { useT } from '@/lib/hooks/use-t'
import type { CallLogEnriched } from '@/lib/types'

export default function DashboardPage() {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState('directeur')
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
              <TabsTrigger value="directeur">🏠 {t('tab.directeur')}</TabsTrigger>
              <TabsTrigger value="stats">📊 {t('tab.stats')}</TabsTrigger>
              <TabsTrigger value="calls">📋 {t('tab.calls')}</TabsTrigger>
              <TabsTrigger value="live" className="gap-2">
                🔴 {t('tab.live')}
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </TabsTrigger>
              <TabsTrigger value="erreurs">⚠️ {t('tab.erreurs')}</TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <span className="text-violet-400">✨</span> {t('tab.insights')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="directeur" className="mt-6">
              <DirectorView
                filteredCalls={filteredCalls}
                allCalls={allCalls}
                leads={leads}
                isLoading={isLoading}
                onSelectCall={handleCallSelect}
              />
            </TabsContent>

            <TabsContent value="erreurs" className="mt-6">
              <ErrorsView allCalls={allCalls} leads={leads} />
            </TabsContent>

            <TabsContent value="stats" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">📊 {t('tab.stats')}</h2>
                <ReportButton allCalls={allCalls} leads={leads} />
              </div>

              <InboundCallsPanel
                calls={filteredCalls}
                onSelectCall={handleCallSelect}
                isLoading={isLoading}
              />

              <BusinessKpis
                metrics={callMetrics}
                business={businessMetrics}
                filteredCalls={filteredCalls}
                allCalls={allCalls}
                leads={leads}
                onSelectCall={handleCallSelect}
                isLoading={isLoading}
              />

              <CallHeatmap
                calls={filteredCalls}
                onSelectCall={handleCallSelect}
                isLoading={isLoading}
              />

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

              <AgentPerformance
                filteredCalls={filteredCalls}
                isLoading={isLoading}
              />

              <StatsExtras
                allCalls={allCalls}
                filteredCalls={filteredCalls}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="insights" className="mt-6 space-y-6">
              <InsightsPanel filteredCalls={filteredCalls} />
            </TabsContent>

            <TabsContent value="calls" className="mt-6 space-y-4">
              <CallLogsFilters />
              <CallLogsTable
                calls={filteredCalls}
                isLoading={isLoading}
                onCallSelect={handleCallSelect}
              />
            </TabsContent>

            <TabsContent value="live" className="mt-6">
              <LiveView allCalls={allCalls} />
            </TabsContent>
          </Tabs>

          {/* Mobile Content */}
          <div className="md:hidden space-y-6">
            {activeTab === 'directeur' && (
              <DirectorView
                filteredCalls={filteredCalls}
                allCalls={allCalls}
                leads={leads}
                isLoading={isLoading}
                onSelectCall={handleCallSelect}
              />
            )}

            {activeTab === 'erreurs' && <ErrorsView allCalls={allCalls} leads={leads} />}

            {activeTab === 'stats' && (
              <>
                <InboundCallsPanel
                  calls={filteredCalls}
                  onSelectCall={handleCallSelect}
                  isLoading={isLoading}
                />
                <BusinessKpis
                  metrics={callMetrics}
                  business={businessMetrics}
                  filteredCalls={filteredCalls}
                  allCalls={allCalls}
                  leads={leads}
                  onSelectCall={handleCallSelect}
                  isLoading={isLoading}
                />
                <CallHeatmap
                calls={filteredCalls}
                onSelectCall={handleCallSelect}
                isLoading={isLoading}
              />
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
                <AgentPerformance
                  filteredCalls={filteredCalls}
                  isLoading={isLoading}
                />
                <StatsExtras
                  allCalls={allCalls}
                  filteredCalls={filteredCalls}
                  isLoading={isLoading}
                />
              </>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-6">
                <InsightsPanel filteredCalls={filteredCalls} />
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="space-y-4">
                <CallLogsFilters />
                <CallLogsTable
                  calls={filteredCalls}
                  isLoading={isLoading}
                  onCallSelect={handleCallSelect}
                />
              </div>
            )}

            {activeTab === 'live' && <LiveView allCalls={allCalls} />}
          </div>
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <CallDetailSheet
        callId={selectedCallId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        allCalls={allCalls}
        onSelectCall={handleCallSelect}
      />
    </div>
  )
}
