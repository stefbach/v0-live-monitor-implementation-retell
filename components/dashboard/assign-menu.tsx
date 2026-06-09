'use client'

import { useState } from 'react'
import { User, ChevronDown, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Single source of truth for the coordinators a patient/lead can be handed to.
export const COORDINATORS = ['Summer', 'Rain', 'Stormi'] as const
export type CoordinatorName = (typeof COORDINATORS)[number]

const dotClass: Record<CoordinatorName, string> = {
  Summer: 'bg-amber-500',
  Rain: 'bg-sky-500',
  Stormi: 'bg-violet-500',
}

/**
 * Reusable "Assign to" dropdown. Writes to the shared dashboard_assignments table
 * via /api/dashboard/assignments, so it stays in sync everywhere (call sheet,
 * people lists, NHS panel, coordinator queues). Stop-propagates clicks so it can
 * live inside a clickable list row without triggering the row.
 */
export function AssignMenu({
  leadId,
  currentAssignee = null,
  onChanged,
  size = 'sm',
}: {
  leadId: string
  currentAssignee?: string | null
  onChanged?: () => void
  size?: 'sm' | 'xs'
}) {
  const [busy, setBusy] = useState(false)

  async function post(body: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, ...body }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; data?: { ok?: boolean; error?: string } }
      if (!res.ok || json?.error || json?.data?.ok === false) {
        throw new Error(json?.error || json?.data?.error || `HTTP ${res.status}`)
      }
      toast.success(okMessage)
      onChanged?.()
    } catch (e) {
      toast.error("Échec de l'opération", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(false)
    }
  }

  const assign = (c: CoordinatorName) =>
    post({ assignedTo: c, reason: 'Assigné depuis le dashboard', assignedBy: 'dashboard' }, `Assigné à ${c}`)
  const unassign = () => post({ action: 'unassign' }, 'Désassigné')

  const sizeCls = size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border font-medium transition-colors disabled:opacity-50 ${sizeCls} ${
            currentAssignee
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-500 hover:bg-violet-500/20'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          }`}
        >
          {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />}
          {currentAssignee ?? 'Assigner'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Assigner à</DropdownMenuLabel>
        {COORDINATORS.map((c) => (
          <DropdownMenuItem key={c} onSelect={() => assign(c)} className="cursor-pointer gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass[c]}`} />
            {c}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => unassign()}
          className="cursor-pointer gap-2 text-red-500 focus:text-red-500"
        >
          <X className="h-3.5 w-3.5" /> Désassigner
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
