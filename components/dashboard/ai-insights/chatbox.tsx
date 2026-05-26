'use client'

import { useRef, useState, useEffect } from 'react'
import { MessageSquare, Send, Sparkles, Trash2, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CallLogEnriched } from '@/lib/types'
import type { InsightsCallInput, InsightsResult } from '@/lib/insights/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  filteredCalls: CallLogEnriched[]
  insights: InsightsResult | null
  periodLabel: string
}

function toLLMInput(calls: CallLogEnriched[]): InsightsCallInput[] {
  return calls.map((c) => ({
    call_id: c.callId,
    summary: c.summary ?? null,
    qualification: c.lead?.qualification ?? null,
    sentiment: c.sentiment ?? null,
    duration_seconds: c.duration,
    hour_of_day: c.hourOfDay,
    day_of_week: c.dayOfWeek,
    disconnection_reason: c.disconnectionReason,
    attempt_number: c.attemptNumber,
    answered: c.answered,
  }))
}

const SUGGESTIONS = [
  'Quel est mon hot lead le plus chaud à rappeler en priorité ?',
  'Résume-moi les objections liées au coût',
  'Quels appels mentionnent le conjoint comme frein ?',
  'Donne-moi 3 patterns observés dans les appels RDV MEDECIN',
]

export function InsightsChatbox({ filteredCalls, insights, periodLabel }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function send(question?: string) {
    const text = (question ?? input).trim()
    if (!text || loading) return
    setError(null)
    const userMsg: ChatMessage = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          calls: toLLMInput(filteredCalls),
          insights,
          period_label: periodLabel,
        }),
      })
      let payload: { data?: { reply: string }; error?: string } | null = null
      try {
        payload = await res.json()
      } catch {
        throw new Error(
          res.status === 504
            ? "Timeout Vercel — réessaie avec une question plus ciblée."
            : `Erreur serveur (${res.status})`
        )
      }
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.error || `Erreur API (${res.status})`)
      }
      setMessages([...next, { role: 'assistant', content: payload.data.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la requête')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setMessages([])
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              Pose une question à l&apos;IA
            </CardTitle>
            <CardDescription>
              L&apos;IA voit les insights ci-dessus + les {filteredCalls.length} appels de la
              période. Elle peut chercher dans les résumés à la demande.
            </CardDescription>
          </div>
          {messages.length > 0 && (
            <Button onClick={reset} variant="ghost" size="sm" className="gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              Nouvelle conversation
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-border bg-muted/10 p-3"
          >
            {messages.map((m, idx) => (
              <div key={idx} className="flex gap-2 text-sm">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  {m.role === 'user' ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 text-sm">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-violet-500" />
                </div>
                <div className="text-sm italic text-muted-foreground">L&apos;IA réfléchit…</div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-950/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Pose ta question… (Cmd/Ctrl + Entrée pour envoyer)"
            className="min-h-[60px] resize-none"
            disabled={loading}
          />
          <Button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="self-end gap-2"
          >
            <Send className="h-4 w-4" />
            Envoyer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
