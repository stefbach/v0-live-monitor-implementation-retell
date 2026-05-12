'use client'

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartSkeleton } from './skeleton-loaders'
import type { DurationBucket } from '@/lib/types'

interface DurationDistributionProps {
  data: DurationBucket[]
  isLoading?: boolean
}

const chartConfig = {
  count: {
    label: 'Calls',
    color: 'hsl(45, 93%, 47%)', // amber-500
  },
} satisfies ChartConfig

export function DurationDistribution({ data, isLoading }: DurationDistributionProps) {
  if (isLoading) {
    return <ChartSkeleton title="Call Duration Distribution" />
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call Duration Distribution</CardTitle>
        <CardDescription>How long calls typically last</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="range"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              width={40}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="hsl(45, 93%, 47%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
