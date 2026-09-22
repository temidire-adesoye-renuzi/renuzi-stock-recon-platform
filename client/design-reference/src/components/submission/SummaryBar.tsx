import React from 'react';
import { SendIcon, ShieldAlertIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatNaira, formatNumber } from '../../utils/format';

interface SummaryBarProps {
  dockedValue: number;
  unrecordedSales: number;
  atRiskSkus: number;
  missingNotes: number;
}

export function SummaryBar({
  dockedValue,
  unrecordedSales,
  atRiskSkus,
  missingNotes
}: SummaryBarProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-8">
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
            Total Docked Value
          </p>
          <p className="num mt-0.5 text-xl font-semibold text-danger">{formatNaira(dockedValue)}</p>
        </div>
        <div className="h-9 w-px bg-neutral-200" aria-hidden="true" />
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
            Unrecorded Sales
          </p>
          <p className="num mt-0.5 text-xl font-semibold text-[#9A6A28]">
            {formatNumber(unrecordedSales)}
          </p>
        </div>
        <div className="h-9 w-px bg-neutral-200" aria-hidden="true" />
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
            At-Risk SKUs
          </p>
          <p className="num mt-0.5 text-xl font-semibold text-ink">{atRiskSkus}</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {missingNotes > 0 ?
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#C22F30]">
              <ShieldAlertIcon className="h-4 w-4" aria-hidden="true" />
              {missingNotes} variance {missingNotes === 1 ? 'note' : 'notes'} required before submit
            </p> :

          <p className="text-xs text-neutral-500">All mandatory variance notes captured</p>
          }
          <Button variant="outline" size="md">
            Save draft
          </Button>
          <Button variant="accent" size="md" className="px-6">
            <SendIcon className="h-4 w-4" aria-hidden="true" />
            SUBMIT
          </Button>
        </div>
      </div>
    </div>);

}