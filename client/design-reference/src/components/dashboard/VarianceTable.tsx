import React from 'react';
import { FlagIcon } from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';
import { formatNaira, formatNumber } from '../../utils/format';
import type { RowStatus, VarianceRecord } from '../../types/recon';

interface VarianceTableProps {
  records: VarianceRecord[];
  flagged: Record<string, boolean>;
  onToggleFlag: (id: string) => void;
}

const rowTone: Record<RowStatus, string> = {
  matched: 'bg-success-10/60 hover:bg-success-10',
  discrepancy: 'bg-danger-10/70 hover:bg-danger-10',
  review: 'bg-warn-10/70 hover:bg-warn-10'
};

const headCell =
'sticky top-0 z-10 bg-brand-10 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-brand';

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
            {records.map((record) =>
            <tr
              key={record.id}
              className={`border-b border-white transition-colors duration-150 ease-out last:border-b-0 ${rowTone[record.status]}`}>
              
                <td className="num px-3 py-2 font-medium text-ink">{record.sku}</td>
                <td className="px-3 py-2 text-ink">{record.name}</td>
                <td className="px-3 py-2 text-neutral-600">{record.location}</td>
                <td className="num px-3 py-2 text-right text-neutral-700">
                  {formatNumber(record.leverEdgeQty)}
                </td>
                <td className="num px-3 py-2 text-right text-neutral-700">
                  {formatNumber(record.physicalUnits)}
                </td>
                <td
                className={`num px-3 py-2 text-right font-semibold ${
                record.docked > 0 ? 'text-danger' : 'text-neutral-400'}`
                }>
                
                  {record.docked > 0 ? formatNumber(record.docked) : '—'}
                </td>
                <td
                className={`num px-3 py-2 text-right font-semibold ${
                record.undocked > 0 ? 'text-[#9A6A28]' : 'text-neutral-400'}`
                }>
                
                  {record.undocked > 0 ? formatNumber(record.undocked) : '—'}
                </td>
                <td className="num px-3 py-2 text-right font-semibold text-ink">
                  {record.dockedValue > 0 ? formatNaira(record.dockedValue) : '—'}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={record.status} />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                  type="button"
                  onClick={() => onToggleFlag(record.id)}
                  aria-pressed={Boolean(flagged[record.id])}
                  aria-label={`Flag ${record.name} for investigation`}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  flagged[record.id] ?
                  'border-accent bg-accent text-white' :
                  'border-neutral-300 bg-white text-neutral-400 hover:border-accent hover:text-accent'}`
                  }>
                  
                    <FlagIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>);

}