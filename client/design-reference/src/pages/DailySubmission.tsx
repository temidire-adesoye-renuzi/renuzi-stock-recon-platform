import React, { useMemo, useState } from 'react';
import { CalendarDaysIcon, MapPinIcon, RefreshCwIcon } from 'lucide-react';
import { CountdownChip } from '../components/submission/CountdownChip';
import { Dropzone } from '../components/submission/Dropzone';
import { SubmissionTable } from '../components/submission/SubmissionTable';
import { SummaryBar } from '../components/submission/SummaryBar';
import { countRows as seedRows } from '../data/countRows';
import { computeRow, summarize } from '../utils/recon';
import type { CountRow } from '../types/recon';

interface DailySubmissionProps {
  lockUrgent: boolean;
}

export function DailySubmission({ lockUrgent }: DailySubmissionProps) {
  const [rows, setRows] = useState<CountRow[]>(seedRows);

  const computed = useMemo(() => rows.map(computeRow), [rows]);
  const totals = useMemo(() => summarize(computed.filter((row) => !row.locked)), [computed]);
  const missingNotes = computed.filter(
    (row) => !row.locked && row.noteRequired && !row.note
  ).length;

  function handleCountChange(id: string, field: 'cs' | 'dz' | 'pc', value: number) {
    setRows((current) =>
    current.map((row) => row.id === id ? { ...row, [field]: Math.max(0, value) } : row)
    );
  }

  function handleNote(id: string) {
    setRows((current) =>
    current.map((row) =>
    row.id === id ?
    { ...row, note: row.note ? undefined : 'Short-supply confirmed with loading bay' } :
    row
    )
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-ink">Daily Submission</h1>
            <p className="text-2xs text-neutral-500">
              Reconcile LeverEdge and Xero exports against the physical count
            </p>
          </div>

          <div className="ml-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-10 px-2.5 py-1.5 text-xs font-semibold text-brand">
              <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Lekki Warehouse
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
              <CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Tue, 22 Sep 2026
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-2xs text-neutral-400">
              <RefreshCwIcon className="h-3 w-3" aria-hidden="true" />
              Autosaved 12:04 PM
            </span>
            <CountdownChip initialSeconds={lockUrgent ? 17 * 60 + 42 : 4 * 3600 + 12 * 60} />
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 px-6 py-4">
        <section aria-labelledby="uploads-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="uploads-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Source Exports
            </h2>
            <p className="text-2xs text-neutral-400">.xlsx or .csv · max 20 MB each</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <Dropzone
              title="LeverEdge Export"
              hint="System stock movement for the selected day"
              uploadedFile="leveredge_lekki_2026-09-22.xlsx"
              uploadedMeta="1,248 rows parsed · 10 SKUs matched" />
            
            <Dropzone
              title="Xero Export"
              hint="Drag the invoiced sales export here" />
            
          </div>
          <div className="mt-3">
            <Dropzone
              compact
              optional
              title="Physical Count File"
              hint="Upload a scanned count sheet to prefill CS / DZ / PC below" />
            
          </div>
        </section>

        <section aria-labelledby="count-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="count-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Physical Count · 10 SKUs
            </h2>
            <p className="text-2xs text-neutral-400">
              Variance ≥ 10 units requires a note before submission
            </p>
          </div>
          <div className="mt-2">
            <SubmissionTable
              rows={computed}
              onCountChange={handleCountChange}
              onNote={handleNote} />
            
          </div>
        </section>
      </div>

      <SummaryBar
        dockedValue={totals.dockedValue}
        unrecordedSales={totals.unrecordedSales}
        atRiskSkus={totals.atRiskSkus}
        missingNotes={missingNotes} />
      
    </main>);

}