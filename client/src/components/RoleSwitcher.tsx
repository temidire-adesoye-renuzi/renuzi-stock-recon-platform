import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersIcon, XIcon } from 'lucide-react'
import { useAuth, homeForRole } from '../auth/AuthContext'
import { useToast } from './Toast'
import { errorMessage } from '../lib/errors'

const DEMO_ACCOUNTS = [
  { email: 'ketu@renuzi', label: 'Ketu Manager', detail: 'warehouse_manager · Ketu' },
  { email: 'lekki@renuzi', label: 'Lekki Manager', detail: 'warehouse_manager · Lekki' },
  { email: 'exec@renuzi', label: 'Executive', detail: 'executive · read-all + flag' },
  { email: 'admin@renuzi', label: 'Admin', detail: 'admin · full access' },
]

/** Floating demo account switcher — visible ONLY in mock mode. */
export function RoleSwitcher() {
  const { mockMode, user, loginAs } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  if (!mockMode) return null

  async function switchTo(email: string, label: string) {
    setBusy(email)
    try {
      const next = await loginAs(email)
      setOpen(false)
      toast(`Switched to ${label} (${next.email})`, 'success')
      navigate(homeForRole(next.role), { replace: true })
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden">
      {open ? (
        <div className="w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_12px_32px_-12px_rgba(17,17,17,0.3)]">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-brand-10 px-3 py-2">
            <UsersIcon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            <p className="flex-1 text-2xs font-semibold uppercase tracking-wide text-brand">
              Demo accounts (mock)
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close role switcher"
              className="rounded p-0.5 text-brand/60 transition-colors duration-150 ease-out hover:text-brand"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="p-1.5">
            {DEMO_ACCOUNTS.map((account) => {
              const active = user?.email === account.email
              return (
                <li key={account.email}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => switchTo(account.email, account.label)}
                    className={`w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 ease-out disabled:opacity-50 ${
                      active
                        ? 'bg-brand-10'
                        : 'hover:bg-neutral-100'
                    }`}
                  >
                    <p className="text-xs font-semibold text-ink">
                      {account.label}
                      {active ? (
                        <span className="ml-1.5 rounded bg-success-10 px-1.5 py-0.5 text-2xs font-medium text-[#00753A]">
                          active
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-2xs text-neutral-500">{account.detail}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-25 bg-white px-3 py-1.5 text-2xs font-semibold text-brand shadow-[0_4px_12px_-4px_rgba(17,17,17,0.24)] transition-colors duration-150 ease-out hover:bg-brand-10"
        >
          <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Role switcher
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-2xs font-semibold text-white">
            mock
          </span>
        </button>
      )}
    </div>
  )
}
