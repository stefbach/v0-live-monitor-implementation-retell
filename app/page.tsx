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
import { InsightsPanel } from '@/components/dashboard/ai-insights/insights-panel'
import { TabPlaceholder } from '@/components/dashboard/tab-placeholder'
import { CallLogsTable } from '@/components/dashboard/call-logs-table'
import { CallDetailSheet } from '@/components/dashboard/call-detail-sheet'
import { LiveMonitor } from '@/components/dashboard/live-monitor'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useDashboardData } from '@/lib/hooks/use-calls'
import type { CallLogEnriched } from '@/lib/types'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('stats')
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
              <TabsTrigger value="directeur">🏠 Vue Directeur</TabsTrigger>
              <TabsTrigger value="stats">📊 Statistiques</TabsTrigger>
              <TabsTrigger value="calls">📋 Call Logs</TabsTrigger>
              <TabsTrigger value="live" className="gap-2">
                🔴 Live
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </TabsTrigger>
              <TabsTrigger value="erreurs">⚠️ Erreurs & Alertes</TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <span className="text-violet-400">✨</span> AI Insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="directeur" className="mt-6">
              <TabPlaceholder
                title="Vue Directeur"
                phase="Phase 2 — en construction"
                description="Le tableau de bord opérationnel (KPIs cliquables, qualifications CRM, suivi J1/J3/J5, dossiers à confier, section agents) arrive à la prochaine étape. La structure de données est déjà en place."
                ctaLabel="Voir les Statistiques en attendant"
                onCta={() => setActiveTab('stats')}
              />
            </TabsContent>

            <TabsContent value="erreurs" className="mt-6">
              <TabPlaceholder
                title="Erreurs & Alertes"
                phase="Phase 5 — en construction"
                description="Log des erreurs système, répondeurs à rappeler, robot awareness et anomalies. Les détecteurs sont déjà codés ; l'écran arrive après la Vue Directeur, les Call Logs et les Statistiques."
                ctaLabel="Voir les Statistiques"
                onCta={() => setActiveTab('stats')}
              />
            </TabsContent>

            <TabsContent value="stats" className="mt-6 space-y-6">
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

            <TabsContent value="insights" className="mt-6">
              <InsightsPanel filteredCalls={filteredCalls} />
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
            {activeTab === 'directeur' && (
              <TabPlaceholder
                title="Vue Directeur"
                phase="Phase 2 — en construction"
                description="Le tableau de bord opérationnel arrive à la prochaine étape."
                ctaLabel="Voir les Statistiques"
                onCta={() => setActiveTab('stats')}
              />
            )}

            {activeTab === 'erreurs' && (
              <TabPlaceholder
                title="Erreurs & Alertes"
                phase="Phase 5 — en construction"
                description="Log des erreurs, répondeurs, robot awareness et anomalies arrivent après les autres onglets."
                ctaLabel="Voir les Statistiques"
                onCta={() => setActiveTab('stats')}
              />
            )}

            {activeTab === 'stats' && (
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

            {activeTab === 'insights' && <InsightsPanel filteredCalls={filteredCalls} />}

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
