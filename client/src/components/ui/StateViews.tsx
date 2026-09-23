import { AlertTriangleIcon, InboxIcon, Loader2Icon } from 'lucide-react'

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-10 text-xs text-neutral-500">
      <Loader2Icon className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
      {label}
    </div>
  )
}

export function EmptyView({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
      <InboxIcon className="mx-auto h-5 w-5 text-neutral-300" aria-hidden="true" />
      <p className="mt-2 text-xs font-medium text-neutral-600">{message}</p>
      {hint ? <p className="mt-1 text-2xs text-neutral-400">{hint}</p> : null}
    </div>
  )
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 rounded-lg border border-danger-25 bg-danger-10 px-4 py-6 text-xs text-[#C22F30]"
    >
      <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 rounded border border-danger-25 bg-white px-2 py-0.5 text-2xs font-medium text-[#C22F30] transition-colors duration-150 ease-out hover:bg-danger-10"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
