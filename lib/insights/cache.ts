import type { InsightsResult } from './types'

interface CacheEntry {
  insights: InsightsResult
  expiresAt: number
}

// Process-local memory cache. Vercel may spin up multiple lambdas so this is
// best-effort. For a persistent cache, move to Supabase or Vercel KV later.
const cache = new Map<string, CacheEntry>()

const TTL_MS = 30 * 60 * 1000 // 30 min

export function getCached(key: string): InsightsResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return { ...entry.insights, meta: { ...entry.insights.meta, cached: true } }
}

export function setCached(key: string, insights: InsightsResult): void {
  cache.set(key, { insights, expiresAt: Date.now() + TTL_MS })
}

// Cheap deterministic hash of the request payload (call ids + period label).
export function makeCacheKey(callIds: string[], periodLabel: string): string {
  // Hash by sorted call_ids — content-based, no need to hash summaries
  const sorted = [...callIds].sort().join('|')
  let hash = 0
  const str = `${periodLabel}::${sorted}`
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return `${periodLabel}-${callIds.length}-${hash.toString(36)}`
}
