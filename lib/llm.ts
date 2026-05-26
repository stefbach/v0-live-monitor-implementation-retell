import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Two LLM clients are available in this app:
//   - DeepSeek (OpenAI-compatible) → currently used by the AI Insights feature
//     for cost reasons (~10× cheaper than Claude).
//   - Anthropic (Claude Sonnet 4.6) → kept available for any future feature
//     where reliability of structured output is critical, or as a manual fallback.

// ─── DeepSeek (primary for AI Insights) ─────────────────────────────────────

let deepseekClient: OpenAI | null = null

export function getDeepSeek(): OpenAI | null {
  if (deepseekClient) return deepseekClient
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null
  deepseekClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com/v1',
  })
  return deepseekClient
}

export function deepseekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}

// deepseek-chat = DeepSeek V3, fast + cheap, supports OpenAI-style tool calling
export const DEEPSEEK_MODEL = 'deepseek-chat'

// ─── Anthropic (kept available, not currently called by insights) ───────────

let anthropicClient: Anthropic | null = null

export function getAnthropic(): Anthropic | null {
  if (anthropicClient) return anthropicClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

// Sonnet 4.6 — needed for quality of structured analysis. Haiku was too
// conservative and returned empty arrays for most sections. Combined with
// reduced input (60 calls, 250 char summaries) to fit Vercel's 60s timeout.
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
