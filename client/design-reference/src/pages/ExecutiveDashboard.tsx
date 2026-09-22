import React, { useMemo, useState } from 'react';
import { DownloadIcon, FilterIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { KpiCard } from '../components/dashboard/KpiCard';
import { DockedTrendChart } from '../components/dashboard/DockedTrendChart';
import { VarianceTable } from '../components/dashboard/VarianceTable';
import { varianceRecords } from '../data/varianceRecords';

const locations = ['All locations', 'Lekki Warehouse', 'Apapa Depot', 'Ikeja Hub'];
const ranges = ['Last 14 days', 'Today', 'Last 7 days', 'This month'];
const categories = ['All categories', 'Beverages', 'Edible Oils', 'Grains', 'Pantry', 'Dairy', 'Home Care'];

export function ExecutiveDashboard() {
  const [location, setLocation] = useState(locations[0]);
  const [range, setRange] = useState(ranges[0]);
  const [category, setCategory] = useState(categories[0]);
  const [flagged, setFlagged] = useState<Record<string, boolean>>(
    Object.fromEntries(varianceRecords.filter((r) => r.flagged).map((r) => [r.id, true]))
  );

  const records = useMemo(
    () =>
    varianceRecords.filter(
      (record) =>
      (location === locations[0] || record.location === location) && (
      category === categories[0] || record.category === category)
    ),
    [location, category]
  );

  const discrepancies = records.filter((record) => record.status !== 'matched').length;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-ink">Executive Dashboard</h1>
            <p className="text-2xs text-neutral-500">
              Network-wide stock variance · updated 12:04 PM WAT
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm">
              <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Export
            </Button>
            <Button variant="primary" size="sm">
              Open audit queue
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-6 py-4">
        <section aria-label="Key performance indicators" className="grid grid-cols-4 gap-4">
          <KpiCard
            emphasis
            tone="danger"
            label="Total Docked Value"
            value="₦192.2M"
            caption="Across 3 locations, 14 days"
            delta="18.4%"
            deltaDirection="up"
            deltaIsBad />
          
          <KpiCard
            tone="warn"
            label="Unrecorded Sales"
            value="526"
            caption="Units sold, not in Xero"
            delta="6.1%"
            deltaDirection="up"
            deltaIsBad />
          
          <KpiCard
            tone="neutral"
            label="Discrepancies"
            value={String(discrepancies)}
            caption="SKUs off tolerance today"
            delta="3 resolved"
            deltaDirection="down" />
          
          <KpiCard
            tone="brand"
            label="Auto-Reorder Risk SKUs"
            value="14"
            caption="Reorder blocked by variance"
            delta="2 cleared"
            deltaDirection="down" />
          
        </section>

        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-neutral-500">
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Slicers
          </span>
          <div className="h-5 w-px bg-neutral-200" aria-hidden="true" />
          <Select label="Location" value={location} options={locations} onChange={setLocation} />
          <Select label="Date range" value={range} options={ranges} onChange={setRange} />
          <Select label="Category" value={category} options={categories} onChange={setCategory} />
          <span className="num ml-auto text-2xs text-neutral-400">
            {records.length} of {varianceRecords.length} SKUs
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section aria-labelledby="variance-heading">
            <div className="flex items-baseline justify-between pb-2">
              <h2
                id="variance-heading"
                className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                
                Variance by SKU
              </h2>
              <p className="text-2xs text-neutral-400">Flagged rows route to the audit queue</p>
            </div>
            <VarianceTable
              records={records}
              flagged={flagged}
              onToggleFlag={(id) =>
              setFlagged((current) => ({ ...current, [id]: !current[id] }))
              } />
            
          </section>

          <div className="space-y-4">
            <DockedTrendChart />
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Submission Status
              </h2>
              <ul className="mt-3 space-y-2.5">
                {[
                { name: 'Lekki Warehouse', state: 'Submitted 11:52 AM', tone: 'success' },
                { name: 'Apapa Depot', state: 'In progress', tone: 'warn' },
                { name: 'Ikeja Hub', state: 'Not started', tone: 'danger' }].
                map((item) =>
                <li key={item.name} className="flex items-center justify-between">
                    <span className="text-xs text-ink">{item.name}</span>
                    <span
                    className={`inline-flex items-center gap-1.5 text-2xs font-medium ${
                    item.tone === 'success' ?
                    'text-[#00753A]' :
                    item.tone === 'warn' ?
                    'text-[#9A6A28]' :
                    'text-danger'}`
                    }>
                    
                      <span
                      className={`h-1.5 w-1.5 rounded-full ${
                      item.tone === 'success' ?
                      'bg-success' :
                      item.tone === 'warn' ?
                      'bg-warn' :
                      'bg-danger'}`
                      }
                      aria-hidden="true" />
                    
                      {item.state}
                    </span>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>);

}