import { Suspense } from 'react'
import { LoginForm } from './login-form'

// Avoid static pre-rendering — useSearchParams() in LoginForm needs a runtime
// request context, and the page is cheap to render on demand.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
