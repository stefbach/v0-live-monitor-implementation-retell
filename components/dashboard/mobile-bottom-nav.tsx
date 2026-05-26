'use client'

import { Home, BarChart3, List, Radio, AlertTriangle, Sparkles, HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/hooks/use-t'

interface MobileBottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'directeur', key: 'tab.directeur', icon: Home },
  { id: 'stats', key: 'tab.stats', icon: BarChart3 },
  { id: 'calls', key: 'tab.calls', icon: List },
  { id: 'live', key: 'tab.live', icon: Radio },
  { id: 'erreurs', key: 'tab.erreurs', icon: AlertTriangle },
  { id: 'insights', key: 'tab.insights', icon: Sparkles },
  { id: 'nhs-suivi', key: 'tab.nhsSuivi', icon: HeartPulse },
]

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { t } = useT()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="text-xs font-medium">{t(tab.key)}</span>
              {tab.id === 'live' && (
                <span className="absolute top-3 right-1/4 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
