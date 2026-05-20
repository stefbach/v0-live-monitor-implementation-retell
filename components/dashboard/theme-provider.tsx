'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/lib/stores/theme-store'

const THEME_CLASSES = ['dark', 'theme-occ'] as const

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    for (const c of THEME_CLASSES) root.classList.remove(c)
    if (theme === 'dark') root.classList.add('dark')
    else if (theme === 'occ') root.classList.add('theme-occ')
    // light → no class (default :root variables apply)
  }, [theme])

  return <>{children}</>
}
