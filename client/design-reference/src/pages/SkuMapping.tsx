import React, { useMemo, useState } from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { UnmappedQueue } from '../components/admin/UnmappedQueue';
import { skuMappings as seedMappings, unmappedSkus as seedUnmapped } from '../data/skuMappings';
import type { SkuMapping } from '../types/recon';

const headCell =
'sticky top-0 z-10 bg-brand-10 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-brand';

export function SkuMappingPage() {
  const [query, setQuery] = useState('');
  const [mappings, setMappings] = useState<SkuMapping[]>(seedMappings);
  const [unmapped, setUnmapped] = useState(seedUnmapped);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return mappings;
    return mappings.filter((row) =>
    [row.leverEdgeCode, row.leverEdgeName, row.xeroCode, row.xeroName, row.category].
    join(' ').
    toLowerCase().
    includes(term)
    );
  }, [mappings, query]);

  function handleAccept(id: string) {
    const item = unmapped.find((entry) => entry.id === id);
    if (!item) return;
    setUnmapped((current) => current.filter((entry) => entry.id !== id));
    setMappings((current) => [
    {
      id: `m-${item.id}`,
      leverEdgeCode: item.sourceCode,
      leverEdgeName: item.sourceName,
      xeroCode: item.suggestionCode,
      xeroName: item.suggestionName,
      csFactor: 12,
      dzFactor: 12,
      category: 'Unclassified',
      active: true
    },
    ...current]
    );
  }

  function toggleActive(id: string) {
    setMappings((current) =>
    current.map((row) => row.id === id ? { ...row, active: !row.active } : row)
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-ink">SKU Mapping</h1>
            <p className="text-2xs text-neutral-500">
              Bind LeverEdge codes to Xero items and set case / dozen conversion factors
            </p>
          </div>
          <div className="ml-auto">
            <Button variant="primary" size="sm">
              <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              New mapping
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-6 py-4">
        <UnmappedQueue
          items={unmapped}
          onAccept={handleAccept}
          onDismiss={(id) => setUnmapped((current) => current.filter((item) => item.id !== id))} />
        

        <section aria-labelledby="mapping-heading">
          <div className="flex items-center justify-between pb-2">
            <h2
              id="mapping-heading"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              
              Active Mappings · {filtered.length}
            </h2>
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true" />
              
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search mappings"
                placeholder="Search code, name or category"
                className="h-8 w-72 rounded-md border border-neutral-300 bg-white pl-8 pr-3 text-xs text-ink transition-colors duration-150 ease-out placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
              
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">LeverEdge to Xero SKU mappings</caption>
                <thead>
                  <tr className="border-b border-brand-25">
                    <th scope="col" className={`${headCell} text-left`}>LeverEdge Code</th>
                    <th scope="col" className={`${headCell} text-left`}>LeverEdge Name</th>
                    <th scope="col" className={`${headCell} text-left`}>Xero Code</th>
                    <th scope="col" className={`${headCell} text-left`}>Xero Name</th>
                    <th scope="col" className={`${headCell} text-right`}>CS Factor</th>
                    <th scope="col" className={`${headCell} text-right`}>DZ Factor</th>
                    <th scope="col" className={`${headCell} text-left`}>Category</th>
                    <th scope="col" className={`${headCell} text-center`}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) =>
                  <tr
                    key={row.id}
                    className={`border-b border-neutral-100 last:border-b-0 ${
                    index % 2 === 1 ? 'bg-neutral-50/60' : 'bg-white'} ${
                    row.active ? '' : 'text-neutral-400'}`}>
                    
                      <td className="num px-3 py-2 font-medium">{row.leverEdgeCode}</td>
                      <td className="px-3 py-2">{row.leverEdgeName}</td>
                      <td className="num px-3 py-2 font-medium text-brand">{row.xeroCode}</td>
                      <td className="px-3 py-2">{row.xeroName}</td>
                      <td className="num px-3 py-2 text-right">{row.csFactor}</td>
                      <td className="num px-3 py-2 text-right">{row.dzFactor}</td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-2xs font-medium text-neutral-600">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                        type="button"
                        role="switch"
                        aria-checked={row.active}
                        aria-label={`Toggle mapping ${row.leverEdgeCode}`}
                        onClick={() => toggleActive(row.id)}
                        className={`relative inline-flex items-center rounded-full transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                        row.active ? 'bg-success' : 'bg-neutral-300'}`
                        }
                        style={{ height: 18, width: 32 }}>
                        
                          <span
                          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ease-out"
                          style={{ transform: `translateX(${row.active ? 16 : 2}px)` }} />
                        
                        </button>
                      </td>
                    </tr>
                  )}
                  {filtered.length === 0 ?
                  <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-xs text-neutral-500">
                        No mappings match “{query}”.
                      </td>
                    </tr> :
                  null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>);

}