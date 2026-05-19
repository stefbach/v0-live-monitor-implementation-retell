'use client'

import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  phase: string
  description: string
  ctaLabel?: string
  onCta?: () => void
}

export function TabPlaceholder({ title, phase, description, ctaLabel, onCta }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Construction className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs uppercase tracking-wide text-violet-400">{phase}</p>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {ctaLabel && onCta && (
          <Button variant="outline" size="sm" onClick={onCta} className="mt-2">
            {ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
