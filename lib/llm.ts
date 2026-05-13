import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropic(): Anthropic | null {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  client = new Anthropic({ apiKey })
  return client
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export const INSIGHTS_MODEL = 'claude-sonnet-4-6'
