import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, Loader2Icon, LockIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuth, homeForRole } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { errorMessage } from '../lib/errors'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, mockMode, user } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const signedIn = await login(email.trim(), password)
      toast(`Welcome back, ${signedIn.name}`, 'success')
      navigate(homeForRole(signedIn.role), { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-full w-full items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(17,17,17,0.06),0_12px_32px_-12px_rgba(17,17,17,0.18)]">
          <div
            className="h-1.5 w-full"
            style={{ background: 'linear-gradient(90deg, #2E3192 0%, #E87724 100%)' }}
            aria-hidden="true"
          />

          <div className="px-8 pb-8 pt-7">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-brand">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <span className="text-sm font-bold tracking-[0.14em] text-brand">RENUZI RECON</span>
            </div>

            <h1 className="mt-6 text-xl font-semibold text-ink">Sign in to continue</h1>
            <p className="mt-1 text-xs text-neutral-500">
              Stock reconciliation for Renuzi Distribution. Submissions lock daily at 6:00 PM WAT.
            </p>

            {user ? (
              <p className="mt-4 rounded-md border border-brand-25 bg-brand-10 px-3 py-2 text-xs text-brand">
                Already signed in as {user.name} — signing in again switches the account.
              </p>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="text-xs font-medium text-ink">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-neutral-300 px-3 text-sm text-ink transition-colors duration-150 ease-out placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="name@renuzi.ng"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-medium text-ink">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-9 w-full rounded-md border border-neutral-300 px-3 pr-9 text-sm text-ink transition-colors duration-150 ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition-colors duration-150 ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-danger-25 bg-danger-10 px-3 py-2 text-xs text-[#C22F30]"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-brand focus:ring-brand"
                  />
                  Keep me signed in
                </label>
                <span className="text-xs font-medium text-neutral-400">Forgot password?</span>
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-2xs text-neutral-400">
              <LockIcon className="h-3 w-3" aria-hidden="true" />
              Access is logged and audited under Renuzi IT Policy 4.2
            </p>
          </div>
        </div>

        {mockMode ? (
          <div className="mt-4 rounded-lg border border-brand-25 bg-brand-10 px-4 py-3 text-center">
            <p className="text-2xs font-semibold uppercase tracking-wide text-brand">
              Mock mode — demo accounts (any password)
            </p>
            <p className="mt-1 text-2xs text-neutral-600">
              ketu@renuzi · lekki@renuzi · exec@renuzi · admin@renuzi
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-center text-2xs text-neutral-400">
          © 2026 Renuzi Distribution Ltd · Lagos, Nigeria
        </p>
      </div>
    </main>
  )
}
