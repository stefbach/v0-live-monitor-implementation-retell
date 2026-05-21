'use client'

import { Moon, Sun, Sparkles } from 'lucide-react'
import { useThemeStore, type Theme } from '@/lib/stores/theme-store'

const OPTIONS: { id: Theme; label: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'occ', label: 'OCC Brand', icon: Sparkles },
]

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5">
      {OPTIONS.map((o) => {
        const Icon = o.icon
        const active = theme === o.id
        return (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            title={o.label}
            aria-pressed={active}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
