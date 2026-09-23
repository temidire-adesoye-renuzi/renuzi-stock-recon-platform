import { useEffect, useState } from 'react'
import type { ComputedPreviewRow } from '../../lib/recon'
import { formatSigned } from '../../lib/format'

interface NoteModalProps {
  row: ComputedPreviewRow | null
  onSave: (sku: string, note: string) => void
  onClose: () => void
}

/** Mandatory variance-note editor for rows with |Total Variance| >= 10. */
export function NoteModal({ row, onSave, onClose }: NoteModalProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(row?.note ?? '')
  }, [row])

  if (!row) return null

  const trimmed = value.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_12px_32px_-12px_rgba(17,17,17,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 id="note-modal-title" className="text-sm font-semibold text-ink">
            Mandatory variance note
          </h2>
          <p className="num mt-0.5 text-2xs text-neutral-500">
            {row.sku} · {row.name || 'Unnamed item'}
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
              <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                LeverEdge
              </p>
              <p className="num mt-0.5 text-xs font-semibold text-ink">
                {row.leverEdgeQty === null ? '—' : formatSigned(row.leverEdgeQty)}
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
              <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">Xero</p>
              <p className="num mt-0.5 text-xs font-semibold text-ink">
                {row.xeroQty === null ? '—' : formatSigned(row.xeroQty)}
              </p>
            </div>
            <div className="rounded-md border border-danger-25 bg-danger-10 px-2.5 py-1.5">
              <p className="text-2xs font-medium uppercase tracking-wide text-[#C22F30]">
                Total Var.
              </p>
              <p className="num mt-0.5 text-xs font-semibold text-[#C22F30]">
                {formatSigned(row.totalVariance)}
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="variance-note" className="text-xs font-medium text-ink">
              Explain the variance (required, min 8 characters)
            </label>
            <textarea
              id="variance-note"
              rows={4}
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. Short-supply confirmed with loading bay; 2 cases damaged in transit."
              className="mt-1.5 w-full rounded-md border border-neutral-300 px-3 py-2 text-xs text-ink transition-colors duration-150 ease-out placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="mt-1 text-2xs text-neutral-500">
              The note is stored on the reconciliation row and shown to executives in the audit
              queue.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-ink transition-colors duration-150 ease-out hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(row.sku, trimmed)}
            disabled={trimmed.length < 8}
            className="h-8 rounded-md bg-accent px-4 text-xs font-medium text-white transition-colors duration-150 ease-out hover:bg-[#CF6718] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  )
}
