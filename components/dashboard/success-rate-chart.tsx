'use client'

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartSkeleton } from './skeleton-loaders'
import type { DailyCallData } from '@/lib/types'

interface SuccessRateChartProps {
  data: DailyCallData[]
  isLoading?: boolean
}

const chartConfig = {
  successRate: {
    label: 'Success Rate',
    color: 'hsl(142, 71%, 45%)', // emerald-500
  },
  failRate: {
    label: 'Fail Rate',
    color: 'hsl(0, 84%, 60%)', // red-500
  },
} satisfies ChartConfig

export function SuccessRateChart({ data, isLoading }: SuccessRateChartProps) {
  if (isLoading) {
    return <ChartSkeleton title="Success Rate Trend" />
  }

  // Calculate success/fail rates
  const chartData = data.map((d) => ({
    ...d,
    successRate: d.calls > 0 ? (d.successful / d.calls) * 100 : 0,
    failRate: d.calls > 0 ? (d.failed / d.calls) * 100 : 0,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Success Rate Trend</CardTitle>
        <CardDescription>Call success vs failure rates over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              width={40}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span>
                      {name}: {typeof value === 'number' ? value.toFixed(1) : value}%
                    </span>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="successRate"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'hsl(142, 71%, 45%)' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="failRate"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'hsl(0, 84%, 60%)' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
