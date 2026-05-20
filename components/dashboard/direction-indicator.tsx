'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  direction: 'inbound' | 'outbound'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
}

// Visual convention (agreed with user, #2):
//   - Entrant  (inbound)  → ↙ flèche vers le bas, couleur verte (emerald)
//   - Sortant  (outbound) → ↗ flèche vers le haut, couleur neutre
export function DirectionIcon({ direction, size = 'md', className }: Props) {
  const Icon = direction === 'inbound' ? ArrowDownLeft : ArrowUpRight
  const color =
    direction === 'inbound' ? 'text-emerald-500' : 'text-muted-foreground'
  return (
    <Icon
      className={cn(SIZES[size], color, className)}
      aria-label={direction === 'inbound' ? 'Entrant' : 'Sortant'}
    />
  )
}
