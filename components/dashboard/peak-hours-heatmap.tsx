'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartSkeleton } from './skeleton-loaders'
import type { HeatmapCell } from '@/lib/types'

interface PeakHoursHeatmapProps {
  data: HeatmapCell[]
  isLoading?: boolean
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hourLabels = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

export function PeakHoursHeatmap({ data, isLoading }: PeakHoursHeatmapProps) {
  if (isLoading) {
    return <ChartSkeleton title="Peak Activity Hours" />
  }

  // Find max value for scaling
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  // Group data by day
  const grid: number[][] = Array(7)
    .fill(null)
    .map(() => Array(24).fill(0))

  data.forEach(({ day, hour, value }) => {
    if (grid[day]) {
      grid[day][hour] = value
    }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Peak Activity Hours</CardTitle>
        <CardDescription>Call volume by day and hour</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {/* Day labels */}
          <div className="flex flex-col justify-between py-1">
            {dayLabels.map((day) => (
              <span key={day} className="text-xs text-muted-foreground h-4 flex items-center">
                {day}
              </span>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[400px]">
              {/* Hour labels */}
              <div className="flex mb-1">
                {hourLabels.map((hour, i) => (
                  <span
                    key={hour}
                    className="text-xs text-muted-foreground flex-1 text-center"
                    style={{ marginLeft: i === 0 ? 0 : undefined }}
                  >
                    {hour}
                  </span>
                ))}
              </div>

              {/* Grid cells */}
              <div className="flex flex-col gap-1">
                {grid.map((row, dayIdx) => (
                  <div key={dayIdx} className="flex gap-[2px]">
                    {row.map((value, hourIdx) => {
                      const intensity = value / maxValue
                      return (
                        <div
                          key={hourIdx}
                          className="flex-1 h-4 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-foreground/20"
                          style={{
                            backgroundColor:
                              value === 0
                                ? 'hsl(var(--muted))'
                                : `hsla(142, 71%, 45%, ${0.2 + intensity * 0.8})`,
                          }}
                          title={`${dayLabels[dayIdx]} ${hourIdx}:00 - ${value} calls`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-[2px]">
                  {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                    <div
                      key={intensity}
                      className="w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor:
                          intensity === 0
                            ? 'hsl(var(--muted))'
                            : `hsla(142, 71%, 45%, ${0.2 + intensity * 0.8})`,
                      }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
