// Cache Retell agent id → friendly name. Refreshed lazily every few minutes.

type AgentMap = Record<string, string>

let cache: { map: AgentMap; fetchedAt: number } | null = null
const TTL_MS = 5 * 60 * 1000

export async function getAgentNameMap(): Promise<AgentMap> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) return {}

  const now = Date.now()
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.map

  try {
    const res = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      // Try the v2 path as a fallback (some Retell deployments expose it there)
      const v2 = await fetch('https://api.retellai.com/v2/list-agents', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!v2.ok) return cache?.map ?? {}
      const v2Json = (await v2.json()) as unknown
      cache = { map: extractAgentNames(v2Json), fetchedAt: now }
      return cache.map
    }
    const json = (await res.json()) as unknown
    cache = { map: extractAgentNames(json), fetchedAt: now }
    return cache.map
  } catch {
    return cache?.map ?? {}
  }
}

function extractAgentNames(payload: unknown): AgentMap {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { agents?: unknown[] })?.agents)
      ? (payload as { agents: unknown[] }).agents
      : []
  const map: AgentMap = {}
  for (const a of list) {
    if (!a || typeof a !== 'object') continue
    const obj = a as Record<string, unknown>
    const id = (obj.agent_id as string) || ''
    const name =
      (obj.agent_name as string) ||
      (obj.name as string) ||
      (obj.voice_id as string) ||
      ''
    if (id) map[id] = name || id
  }
  return map
}
