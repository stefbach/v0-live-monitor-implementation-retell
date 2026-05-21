'use client'

import { useCallback } from 'react'
import { useLangStore } from '@/lib/stores/lang-store'
import { translate } from '@/lib/i18n'

export function useT() {
  const lang = useLangStore((s) => s.lang)
  const t = useCallback((key: string) => translate(lang, key), [lang])
  return { t, lang }
}
