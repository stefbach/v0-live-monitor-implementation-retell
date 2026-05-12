'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Search, ChevronUp, ChevronDown, Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from './skeleton-loaders'
import type { CallLog } from '@/lib/types'

interface CallLogsTableProps {
  calls: CallLog[]
  isLoading?: boolean
  onCallSelect?: (call: CallLog) => void
}

type SortField = 'startTime' | 'duration' | 'status'
type SortDirection = 'asc' | 'desc'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getStatusBadge(status: CallLog['status']) {
  const variants: Record<CallLog['status'], { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    active: { label: 'Active', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    failed: { label: 'Failed', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    'no-answer': { label: 'No Answer', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    busy: { label: 'Busy', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  }
  const variant = variants[status]
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  )
}

export function CallLogsTable({ calls, isLoading, onCallSelect }: CallLogsTableProps) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 10

  const filteredAndSortedCalls = useMemo(() => {
    let result = [...calls]

    // Filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (call) =>
          call.agentName.toLowerCase().includes(searchLower) ||
          call.userName?.toLowerCase().includes(searchLower) ||
          call.fromNumber.includes(search) ||
          call.toNumber.includes(search)
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'startTime':
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [calls, search, sortField, sortDirection])

  const paginatedCalls = useMemo(() => {
    const start = page * pageSize
    return filteredAndSortedCalls.slice(start, start + pageSize)
  }, [filteredAndSortedCalls, page])

  const totalPages = Math.ceil(filteredAndSortedCalls.length / pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  if (isLoading) {
    return <TableSkeleton rows={pageSize} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Call Logs</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">
                    <button
                      onClick={() => handleSort('startTime')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Time
                      <SortIcon field="startTime" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium">Direction</th>
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium">Contact</th>
                  <th className="pb-3 font-medium">
                    <button
                      onClick={() => handleSort('duration')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Duration
                      <SortIcon field="duration" />
                    </button>
                  </th>
                  <th className="pb-3 font-medium">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Status
                      <SortIcon field="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onCallSelect?.(call)}
                  >
                    <td className="py-3 text-sm">
                      {format(new Date(call.startTime), 'MMM d, HH:mm')}
                    </td>
                    <td className="py-3">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-emerald-500" />
                      )}
                    </td>
                    <td className="py-3 text-sm">{call.agentName}</td>
                    <td className="py-3 text-sm">
                      <div>
                        <p className="font-medium">{call.userName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 text-sm font-mono">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="py-3">{getStatusBadge(call.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {paginatedCalls.map((call) => (
            <div
              key={call.id}
              className="rounded-lg border border-border/50 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onCallSelect?.(call)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="h-5 w-5 text-blue-500" />
                    ) : (
                      <PhoneOutgoing className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{call.userName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{call.agentName}</p>
                  </div>
                </div>
                {getStatusBadge(call.status)}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>{format(new Date(call.startTime), 'MMM d, HH:mm')}</span>
                <span className="font-mono">{formatDuration(call.duration)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredAndSortedCalls.length)} of{' '}
              {filteredAndSortedCalls.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {filteredAndSortedCalls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              {search ? 'No calls match your search' : 'No calls yet'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
