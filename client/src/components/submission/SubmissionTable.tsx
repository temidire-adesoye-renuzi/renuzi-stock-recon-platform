import { LockIcon, MessageSquarePlusIcon, MessageSquareTextIcon } from 'lucide-react'
import { StatusPill } from '../ui/StatusPill'
import { formatNumber } from '../../lib/format'
import type { ComputedPreviewRow } from '../../lib/recon'

interface SubmissionTableProps {
  rows: ComputedPreviewRow[]
  locked: boolean
  onCountChange: (sku: string, field: 'cs' | 'dz' | 'pc', value: number) => void
  onOpenNote: (sku: string) => void
}

const headCell =
  'sticky top-0 z-10 bg-brand-10 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-brand'

function varianceCell(value: number, positiveClass: string): { text: string; className: string } {
  if (value > 0) return { text: formatNumber(value), className: positiveClass }
  if (value < 0) return { text: `-${formatNumber(Math.abs(value))}`, className: 'text-danger' }
  return { text: '—', className: 'text-neutral-400' }
}

export function SubmissionTable({ rows, locked, onCountChange, onOpenNote }: SubmissionTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[1180px] border-collapse text-xs">
        <caption className="sr-only">Physical count reconciliation</caption>
        <thead>
          <tr className="border-b border-brand-25">
            <th scope="col" className={`${headCell} text-left`}>
              SKU
            </th>
            <th scope="col" className={`${headCell} text-left`}>
              Item Name
            </th>
            <th scope="col" className={`${headCell} text-center`}>
              CS
            </th>
            <th scope="col" className={`${headCell} text-center`}>
              DZ
            </th>
            <th scope="col" className={`${headCell} text-center`}>
              PC
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              LeverEdge Qty
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Xero Qty
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Physical Units
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Docked
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Undocked
            </th>
            <th scope="col" className={`${headCell} text-right`}>
              Total Var.
            </th>
            <th scope="col" className={`${headCell} text-left`}>
              Status
            </th>
            <th scope="col" className={`${headCell} text-center`}>
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const docked = varianceCell(row.docked, 'text-danger')
            const undocked = varianceCell(row.undocked, 'text-[#9A6A28]')
            const total = varianceCell(row.totalVariance, 'text-ink')
            const pillStatus = row.unmapped
              ? ('Unmapped' as const)
              : row.needsReview
                ? ('Needs Review' as const)
                : row.status
            return (
              <tr
                key={row.sku}
                className={`border-b border-neutral-100 last:border-b-0 ${
                  locked
                    ? 'bg-neutral-100 text-neutral-400'
                    : index % 2 === 1
                      ? 'bg-neutral-50/60'
                      : 'bg-white'
                }`}
              >
                <td className="num px-3 py-2 font-medium text-inherit">{row.sku}</td>
                <td className="px-3 py-2">
                  <span className={locked ? 'text-neutral-400' : 'text-ink'}>
                    {row.name || '—'}
                  </span>
                  {row.unmapped ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded border border-warn-25 bg-warn-10 px-1.5 py-0.5 text-2xs font-medium text-[#9A6A28]">
                      Unmapped SKU
                    </span>
                  ) : null}
                  {locked ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-2xs font-medium text-neutral-500">
                      <LockIcon className="h-3 w-3" aria-hidden="true" />
                      Locked for Executive Audit
                    </span>
                  ) : null}
                </td>

                {(['cs', 'dz', 'pc'] as const).map((field) => (
                  <td key={field} className="px-3 py-2 text-center">
                    <input
                      type="number"
                      value={row[field]}
                      disabled={locked}
                      aria-label={`${field.toUpperCase()} count for ${row.name || row.sku}`}
                      onChange={(event) => {
                        const raw = Number(event.target.value)
                        onCountChange(row.sku, field, Number.isFinite(raw) ? raw : 0)
                      }}
                      className={`num h-7 w-14 rounded border bg-white px-1.5 text-right text-xs text-ink transition-colors duration-150 ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 ${
                        row[field] < 0 ? 'border-danger text-danger' : 'border-neutral-300'
                      }`}
                    />
                    {row[field] < 0 ? (
                      <span className="mt-0.5 block text-2xs font-medium text-danger">
                        cannot be negative
                      </span>
                    ) : null}
                  </td>
                ))}

                <td className="num px-3 py-2 text-right">
                  {row.leverEdgeQty === null ? '—' : formatNumber(row.leverEdgeQty)}
                </td>
                <td className="num px-3 py-2 text-right">
                  {row.xeroQty === null ? '—' : formatNumber(row.xeroQty)}
                </td>
                <td className="num px-3 py-2 text-right font-semibold text-ink">
                  {formatNumber(row.physicalUnits)}
                </td>
                <td
                  className={`num px-3 py-2 text-right font-semibold ${docked.className}`}
                  title={row.docked < 0 ? 'Physical count exceeds LeverEdge stock' : undefined}
                >
                  {docked.text}
                </td>
                <td className={`num px-3 py-2 text-right font-semibold ${undocked.className}`}>
                  {undocked.text}
                </td>
                <td className={`num px-3 py-2 text-right font-semibold ${total.className}`}>
                  {total.text}
                </td>
                <td className="px-3 py-2">
                  {locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-2xs font-medium text-neutral-500">
                      <LockIcon className="h-3 w-3" aria-hidden="true" />
                      Locked
                    </span>
                  ) : (
                    <StatusPill status={pillStatus} />
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {locked ? (
                    <span className="text-neutral-300">—</span>
                  ) : row.noteRequired ? (
                    <button
                      type="button"
                      onClick={() => onOpenNote(row.sku)}
                      title={row.note || 'Mandatory variance note required'}
                      aria-label={`Variance note for ${row.name || row.sku} (mandatory)`}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        row.note
                          ? 'border-success-25 bg-success-10 text-[#00753A]'
                          : 'border-danger-25 bg-danger-10 text-danger hover:bg-danger-25'
                      }`}
                    >
                      {row.note ? (
                        <MessageSquareTextIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <MessageSquarePlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-3 py-10 text-center text-xs text-neutral-500">
                Upload the LeverEdge and Xero exports to build today&apos;s count table.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
