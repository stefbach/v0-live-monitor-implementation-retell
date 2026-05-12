'use client'

import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartSkeleton } from './skeleton-loaders'
import type { HourlyCallData } from '@/lib/types'

interface CallVolumeChartProps {
  data: HourlyCallData[]
  isLoading?: boolean
}

const chartConfig = {
  calls: {
    label: 'Total Calls',
    color: 'hsl(221, 83%, 53%)', // blue-500
  },
  successful: {
    label: 'Successful',
    color: 'hsl(142, 71%, 45%)', // emerald-500
  },
} satisfies ChartConfig

export function CallVolumeChart({ data, isLoading }: CallVolumeChartProps) {
  if (isLoading) {
    return <ChartSkeleton title="Call Volume" />
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call Volume</CardTitle>
        <CardDescription>Hourly call distribution today</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSuccessful" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.split(':')[0]}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              width={40}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="calls"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCalls)"
            />
            <Area
              type="monotone"
              dataKey="successful"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSuccessful)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
