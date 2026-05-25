'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createAuthClient } from '@/lib/supabase-auth/client'

export function LoginForm() {
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createAuthClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        setError('Email ou mot de passe incorrect.')
        setIsSubmitting(false)
        return
      }
      window.location.href = next.startsWith('/') ? next : '/'
    } catch {
      setError('Erreur réseau, veuillez réessayer.')
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>Obesity Care Clinic</CardTitle>
        <CardDescription>
          Accès au tableau de bord — veuillez vous connecter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion…
              </>
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
