import { ArrowRightIcon, SparklesIcon, XIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import type { UnmappedSku } from '../../lib/apiTypes'

interface UnmappedQueueProps {
  items: UnmappedSku[]
  busyId: string | null
  onAccept: (item: UnmappedSku) => void
  onDismiss: (item: UnmappedSku) => void
}

export function UnmappedQueue({ items, busyId, onAccept, onDismiss }: UnmappedQueueProps) {
  return (
    <section
      aria-labelledby="unmapped-heading"
      className="rounded-lg border border-accent-25 bg-accent-10 p-4"
    >
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="unmapped-heading" className="text-sm font-semibold text-ink">
          Unmapped SKUs
        </h2>
        <span className="num rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-white">
          {items.length}
        </span>
        <p className="ml-2 text-2xs text-neutral-600">
          Fuzzy matches from recent LeverEdge exports. Accepting creates a permanent mapping.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-accent-50 bg-white px-4 py-6 text-center text-xs text-neutral-500">
          Queue clear — every SKU in the latest export is mapped.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 rounded-md border border-neutral-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-[260px]">
                <p className="num text-2xs font-medium text-neutral-500">{item.sourceCode}</p>
                <p className="text-xs font-semibold text-ink">{item.sourceName}</p>
              </div>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
              <div className="min-w-[240px]">
                <p className="num text-2xs font-medium text-neutral-500">{item.suggestionCode}</p>
                <p className="text-xs font-semibold text-brand">{item.suggestionName}</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="w-28">
                  <div className="flex items-center justify-between text-2xs text-neutral-500">
                    <span>Confidence</span>
                    <span className="num font-semibold text-ink">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className={`h-full rounded-full ${
                        item.confidence >= 0.85 ? 'bg-success' : 'bg-warn'
                      }`}
                      style={{ width: `${Math.min(100, item.confidence * 100)}%` }}
                    />
                  </div>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => onAccept(item)}
                >
                  {busyId === item.id ? 'Accepting…' : 'Accept'}
                </Button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => onDismiss(item)}
                  aria-label={`Dismiss suggestion for ${item.sourceName}`}
                  className="rounded p-1.5 text-neutral-400 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                >
                  <XIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
