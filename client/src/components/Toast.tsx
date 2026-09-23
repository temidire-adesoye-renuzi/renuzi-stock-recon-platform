import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XIcon } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_LIFETIME_MS = 4500

const kindStyles: Record<ToastKind, { rail: string; icon: string; Icon: typeof InfoIcon }> = {
  success: { rail: 'bg-success', icon: 'text-success', Icon: CheckCircle2Icon },
  error: { rail: 'bg-danger', icon: 'text-danger', Icon: AlertTriangleIcon },
  info: { rail: 'bg-brand', icon: 'text-brand', Icon: InfoIcon },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current
      nextId.current += 1
      setToasts((current) => [...current, { id, kind, message }])
      window.setTimeout(() => dismiss(id), TOAST_LIFETIME_MS)
    },
    [dismiss]
  )

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
      >
        {toasts.map((item) => {
          const styles = kindStyles[item.kind]
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto relative overflow-hidden rounded-lg border border-neutral-200 bg-white py-2.5 pl-4 pr-9 shadow-[0_8px_24px_-8px_rgba(17,17,17,0.24)] ${styles.rail === 'bg-danger' ? 'border-l-4 border-l-danger' : styles.rail === 'bg-success' ? 'border-l-4 border-l-success' : 'border-l-4 border-l-brand'}`}
            >
              <div className="flex items-start gap-2.5">
                <styles.Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`}
                  aria-hidden="true"
                />
                <p className="text-xs text-ink">{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="absolute right-2 top-2.5 rounded p-0.5 text-neutral-400 transition-colors duration-150 ease-out hover:text-ink"
              >
                <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) throw new Error('useToast must be used inside ToastProvider')
  return context
}
