import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearSession } from '../lib/api'

interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  location?: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => setError('Could not load your profile.'))
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-lg">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Phase 1 placeholder — reporting arrives later.</p>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
        {user && (
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-800/40 p-4 text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="mt-1 text-slate-400">{user.email}</p>
            <p className="mt-2">
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                {user.role.replace('_', ' ')}
              </span>
              {user.location && (
                <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
                  {user.location}
                </span>
              )}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
