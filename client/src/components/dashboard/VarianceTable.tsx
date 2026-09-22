import { FlagIcon } from 'lucide-react'
import { StatusPill, type RowStatus } from '../ui/StatusPill'
import { formatNaira, formatNumber } from '../../lib/format'
import type { ReconciliationRow } from '../../lib/apiTypes'

export type VarianceTone = 'Matched' | 'Discrepancy' | 'Review'

interface VarianceTableProps {
  records: ReconciliationRow[]
  flagged: Record<string, boolean>
  onToggleFlag: (row: ReconciliationRow) => void
}

export function toneFor(row: ReconciliationRow): VarianceTone {
  if (row.Needs_Review || row.Status === 'Unmapped') return 'Review'
  if (row.Status === 'Matched') return 'Matched'
  return 'Discrepancy'
}

const rowTone: Record<VarianceTone, string> = {
  Matched: 'bg-success-10/60 hover:bg-success-10',
  Discrepancy: 'bg-danger-10/70 hover:bg-danger-10',
  Review: 'bg-warn-10/70 hover:bg-warn-10',
}

const headCell =
  'sticky top-0 z-10 bg-brand-10 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-brand'

export function VarianceTable({ records, flagged, onToggleFlag }: VarianceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="max-h-[430px] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Variance by SKU across locations</caption>
          <thead>
            <tr className="border-b border-brand-25">
              <th scope="col" className={`${headCell} text-left`}>SKU</th>
              <th scope="col" className={`${headCell} text-left`}>Item</th>
              <th scope="col" className={`${headCell} text-left`}>Location</th>
              <th scope="col" className={`${headCell} text-right`}>LeverEdge</th>
              <th scope="col" className={`${headCell} text-right`}>Physical</th>
              <th scope="col" className={`${headCell} text-right`}>Docked</th>
              <th scope="col" className={`${headCell} text-right`}>Undocked</th>
              <th scope="col" className={`${headCell} text-right`}>Docked ₦</th>
              <th scope="col" className={`${headCell} text-left`}>Status</th>
              <th scope="col" className={`${headCell} text-center`}>Flag</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const tone = toneFor(record)
              const flagId = `${record.Date}:${record.Location}:${record.SKU_Code}`
              const docked = record.Docked_Qty ?? 0
              const undocked = record.Undocked_Qty ?? 0
              const dockedValue =
                docked > 0 && record.Unit_Price_NGN !== null
                  ? docked * record.Unit_Price_NGN
                  : 0
              const pill: RowStatus =
                record.Status === 'Unmapped'
                  ? 'Unmapped'
                  : record.Needs_Review
                    ? 'Needs Review'
                    : record.Status
              return (
                <tr
                  key={flagId}
                  title={record.Notes || undefined}
                  className={`border-b border-white transition-colors duration-150 ease-out last:border-b-0 ${rowTone[tone]}`}
                >
                  <td className="num px-3 py-2 font-medium text-ink">{record.SKU_Code}</td>
                  <td className="px-3 py-2 text-ink">{record.Item_Name || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{record.Location}</td>
                  <td className="num px-3 py-2 text-right text-neutral-700">
                    {record.LeverEdge_Qty === null ? '—' : formatNumber(record.LeverEdge_Qty)}
                  </td>
                  <td className="num px-3 py-2 text-right text-neutral-700">
                    {record.Physical_Units === null ? '—' : formatNumber(record.Physical_Units)}
                  </td>
                  <td
                    className={`num px-3 py-2 text-right font-semibold ${
                      docked > 0 ? 'text-danger' : 'text-neutral-400'
                    }`}
                  >
                    {docked > 0 ? formatNumber(docked) : '—'}
                  </td>
                  <td
                    className={`num px-3 py-2 text-right font-semibold ${
                      undocked > 0 ? 'text-[#9A6A28]' : 'text-neutral-400'
                    }`}
                  >
                    {undocked > 0 ? formatNumber(undocked) : '—'}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-ink">
                    {dockedValue > 0 ? formatNaira(dockedValue) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={pill} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleFlag(record)}
                      aria-pressed={Boolean(flagged[flagId])}
                      aria-label={`Flag ${record.Item_Name || record.SKU_Code} for investigation`}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        flagged[flagId]
                          ? 'border-accent bg-accent text-white'
                          : 'border-neutral-300 bg-white text-neutral-400 hover:border-accent hover:text-accent'
                      }`}
                    >
                      <FlagIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
