'use client'

import { RefreshCw, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTimeRangeStore } from '@/lib/stores/time-range-store'
import { useThemeStore } from '@/lib/stores/theme-store'
import { LangToggle } from './lang-toggle'
import { ThemeToggle } from './theme-toggle'
import { useT } from '@/lib/hooks/use-t'
import type { TimeRange } from '@/lib/types'

interface DashboardHeaderProps {
  onRefresh?: () => void
  isRefreshing?: boolean
}

const OCC_LOGO_URL =
  'https://obesity-care-clinic.com/wp-content/uploads/2023/01/OCC_BLUE_White_Background.png'

export function DashboardHeader({ onRefresh, isRefreshing }: DashboardHeaderProps) {
  const { timeRange, setTimeRange } = useTimeRangeStore()
  const { t } = useT()
  const theme = useThemeStore((s) => s.theme)

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {theme === 'occ' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={OCC_LOGO_URL}
            alt="OCC"
            className="h-10 w-auto rounded bg-white p-1"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t('app.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ThemeToggle />
        <LangToggle />
        <Select
          value={timeRange}
          onValueChange={(value: TimeRange) => setTimeRange(value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('timerange.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">{t('timerange.hourly')}</SelectItem>
            <SelectItem value="daily">{t('timerange.daily')}</SelectItem>
            <SelectItem value="weekly">{t('timerange.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('timerange.monthly')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh data</span>
        </Button>
      </div>
    </header>
  )
}
