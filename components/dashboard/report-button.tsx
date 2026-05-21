'use client'

import { useState } from 'react'
import { FileDown, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFiltersStore } from '@/lib/stores/filters-store'
import {
  buildReportData,
  generatePdf,
  generateCsv,
  reportFilename,
  downloadBlob,
  type Frequency,
  type Format,
} from '@/lib/report'
import type { CallLogEnriched, Lead } from '@/lib/types'

interface Props {
  allCalls: CallLogEnriched[]
  leads: Lead[]
}

export function ReportButton({ allCalls, leads }: Props) {
  const filters = useFiltersStore((s) => s.filters)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handle = async (frequency: Frequency, format: Format) => {
    setBusy(frequency + format)
    try {
      // Yield to the UI thread so the spinner shows
      await new Promise((r) => setTimeout(r, 50))
      const data = buildReportData({ allCalls, leads, filters, frequency })
      const filename = reportFilename({
        periodLabel: data.periodLabel,
        frequency,
        format,
      })
      const blob =
        format === 'pdf' ? generatePdf(data, frequency) : generateCsv(data, frequency)
      downloadBlob(blob, filename)
      setOpen(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="h-4 w-4" />
          Générer un rapport
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          Rapport sur la période active
        </p>
        <div className="grid gap-1">
          <ReportRow
            label="Journalier · PDF"
            busy={busy === 'dailypdf'}
            onClick={() => handle('daily', 'pdf')}
          />
          <ReportRow
            label="Journalier · CSV"
            busy={busy === 'dailycsv'}
            onClick={() => handle('daily', 'csv')}
          />
          <ReportRow
            label="Hebdomadaire · PDF"
            busy={busy === 'weeklypdf'}
            onClick={() => handle('weekly', 'pdf')}
          />
          <ReportRow
            label="Hebdomadaire · CSV"
            busy={busy === 'weeklycsv'}
            onClick={() => handle('weekly', 'csv')}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ReportRow({
  label,
  busy,
  onClick,
}: {
  label: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
    >
      <span>{label}</span>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </button>
  )
}
