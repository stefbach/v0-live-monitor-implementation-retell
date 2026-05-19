'use client'

import { useHealthStatus } from '@/lib/hooks/use-calls'
import { useT } from '@/lib/hooks/use-t'

export function ApiStatus() {
  const { health, isError } = useHealthStatus()
  const { t } = useT()
  const ok = !!health && !isError && (health.apiKeyConfigured ?? true)
  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {ok && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            ok ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
      </span>
      <span className="text-xs font-medium">
        {ok ? t('api.ok') : t('api.down')}
      </span>
    </div>
  )
}
