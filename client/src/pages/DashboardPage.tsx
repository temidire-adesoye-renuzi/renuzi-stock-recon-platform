import { useCallback, useEffect, useMemo, useState } from 'react'
import { DownloadIcon, FilterIcon, HistoryIcon, XIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { ErrorView, LoadingView } from '../components/ui/StateViews'
import { KpiCard } from '../components/dashboard/KpiCard'
import { VarianceTable } from '../components/dashboard/VarianceTable'
import { DockedTrendChart } from '../components/dashboard/DockedTrendChart'
import type {
  AuditEntry,
  ReconciliationRow,
  SkuMappingEntry,
  StatusResult,
} from '../lib/apiTypes'
import { errorMessage } from '../lib/errors'
import { formatNaira, formatNumber } from '../lib/format'
import { listFlags, toggleFlag } from '../lib/flags'
import { lastLagosDates } from '../lib/wat'

const RANGE_OPTIONS = [
  { value: '14', label: 'Last 14 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '1', label: 'Today' },
]

function pctDelta(
  current: number,
  previous: number,
): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { text: '', direction: 'flat' }
  if (previous === 0) return { text: 'new', direction: 'up' }
  const pct = ((current - previous) / previous) * 100
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Number(pct.toFixed(1))
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded}%`,
    direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat',
  }
}

function toCsv(rows: ReconciliationRow[]): string {
  const headers = Object.keys(rows[0] ?? {}) as Array<keyof ReconciliationRow>
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((header) => escape(row[header])).join(','))
  return lines.join('\n')
}

export default function DashboardPage() {
  const { api } = useAuth()
  const { toast } = useToast()
  const dates = useMemo(() => lastLagosDates(14), [])
  const today = dates[dates.length - 1]

  const [locations, setLocations] = useState<string[]>([])
  const [statuses, setStatuses] = useState<StatusResult[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mappings, setMappings] = useState<SkuMappingEntry[]>([])
  const [flags, setFlags] = useState<Record<string, boolean>>(() => listFlags())

  const [location, setLocation] = useState('all')
  const [range, setRange] = useState('14')
  const [category, setCategory] = useState('all')

  const [auditOpen, setAuditOpen] = useState(false)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    setStatuses(null)
    api
      .listLocations()
      .then(async (locs) => {
        const safeLocs = locs.length > 0 ? locs : ['Ketu', 'Lekki']
        const results = await Promise.all(
          safeLocs.flatMap((loc) =>
            dates.map((date) => api.getReconciliationStatus(date, loc).catch(() => null)),
          ),
        )
        setLocations(safeLocs)
        setStatuses(results.filter((item): item is StatusResult => item !== null))
      })
      .catch((error) => setLoadError(errorMessage(error)))
    api
      .listMappings()
      .then(setMappings)
      .catch(() => setMappings([]))
  }, [api, dates])

  useEffect(() => {
    load()
  }, [load])

  const allRows = useMemo(() => {
    if (statuses === null) return []
    return statuses.flatMap((status) => status.rows)
  }, [statuses])

  const categoryBySku = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of mappings) map.set(entry.leverEdgeSkuCode, entry.category)
    return map
  }, [mappings])

  const categories = useMemo(() => {
    const unique = [...new Set(mappings.map((entry) => entry.category).filter(Boolean))]
    return unique.sort()
  }, [mappings])

  const scopedDates = useMemo(() => {
    const days = Number(range)
    return dates.slice(-days)
  }, [dates, range])

  const filtered = useMemo(
    () =>
      allRows.filter((row) => {
        if (!scopedDates.includes(row.Date)) return false
        if (location !== 'all' && row.Location !== location) return false
        if (category !== 'all' && categoryBySku.get(row.SKU_Code) !== category) return false
        return true
      }),
    [allRows, scopedDates, location, category, categoryBySku],
  )

  const previousRows = useMemo(() => {
    const days = Number(range)
    const previous = dates.slice(-(days * 2), -days)
    return allRows.filter((row) => {
      if (!previous.includes(row.Date)) return false
      if (location !== 'all' && row.Location !== location) return false
      if (category !== 'all' && categoryBySku.get(row.SKU_Code) !== category) return false
      return true
    })
  }, [allRows, dates, range, location, category, categoryBySku])

  const kpis = useMemo(() => {
    const sum = (rows: ReconciliationRow[], pick: (row: ReconciliationRow) => number): number =>
      rows.reduce((total, row) => total + pick(row), 0)
    const dockedValue = sum(filtered, (row) =>
      row.Docked_Qty !== null && row.Unit_Price_NGN !== null && row.Docked_Qty > 0
        ? row.Docked_Qty * row.Unit_Price_NGN
        : 0,
    )
    const prevDockedValue = sum(previousRows, (row) =>
      row.Docked_Qty !== null && row.Unit_Price_NGN !== null && row.Docked_Qty > 0
        ? row.Docked_Qty * row.Unit_Price_NGN
        : 0,
    )
    const undocked = sum(filtered, (row) =>
      row.Undocked_Qty !== null && row.Undocked_Qty > 0 ? row.Undocked_Qty : 0,
    )
    const prevUndocked = sum(previousRows, (row) =>
      row.Undocked_Qty !== null && row.Undocked_Qty > 0 ? row.Undocked_Qty : 0,
    )
    const discrepancies = filtered.filter((row) => row.Status !== 'Matched').length
    const prevDiscrepancies = previousRows.filter((row) => row.Status !== 'Matched').length
    const atRisk = filtered.filter((row) => row.Needs_Review).length
    const prevAtRisk = previousRows.filter((row) => row.Needs_Review).length

    return {
      dockedValue,
      dockedDelta: pctDelta(dockedValue, prevDockedValue),
      undocked,
      undockedDelta: pctDelta(undocked, prevUndocked),
      discrepancies,
      discrepancyDelta: {
        text:
          discrepancies < prevDiscrepancies
            ? `${prevDiscrepancies - discrepancies} resolved`
            : discrepancies > prevDiscrepancies
              ? `+${discrepancies - prevDiscrepancies} new`
              : 'steady',
        direction: discrepancies < prevDiscrepancies ? ('down' as const) : ('up' as const),
      },
      atRisk,
      atRiskDelta: {
        text:
          atRisk < prevAtRisk
            ? `${prevAtRisk - atRisk} cleared`
            : atRisk > prevAtRisk
              ? `+${atRisk - prevAtRisk} new`
              : 'steady',
        direction: atRisk < prevAtRisk ? ('down' as const) : ('up' as const),
      },
    }
  }, [filtered, previousRows])

  const trend = useMemo(() => {
    return dates.map((date) => ({
      date,
      valueNgn: filtered
        .filter((row) => row.Date === date)
        .reduce(
          (total, row) =>
            total +
            (row.Docked_Qty !== null && row.Unit_Price_NGN !== null && row.Docked_Qty > 0
              ? row.Docked_Qty * row.Unit_Price_NGN
              : 0),
          0,
        ),
    }))
  }, [dates, filtered])

  const submissionStatus = useMemo(() => {
    return locations.map((loc) => {
      const submitted = allRows.find((row) => row.Date === today && row.Location === loc)
      return { location: loc, submittedAt: submitted?.Submitted_At ?? null }
    })
  }, [locations, allRows, today])

  function handleToggleFlag(row: ReconciliationRow) {
    toggleFlag(row)
    setFlags(listFlags())
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast('Nothing to export for the current filters', 'info')
      return
    }
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `renuzi-variance-${today}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${filtered.length} rows`, 'success')
  }

  function openAudit() {
    setAuditOpen(true)
    setAudit(null)
    setAuditError(null)
    api
      .listAudit({ limit: 50 })
      .then((result) => setAudit(result.entries))
      .catch((error) => setAuditError(errorMessage(error)))
  }

  if (statuses === null && loadError === null) {
    return (
      <main className="flex min-h-full flex-1 flex-col">
        <Header onExport={handleExport} onAudit={openAudit} />
        <div className="px-6 py-4">
          <LoadingView label="Loading 14 days of reconciliation data…" />
        </div>
      </main>
    )
  }

  if (loadError !== null) {
    return (
      <main className="flex min-h-full flex-1 flex-col">
        <Header onExport={handleExport} onAudit={openAudit} />
        <div className="px-6 py-4">
          <ErrorView message={loadError} onRetry={load} />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header onExport={handleExport} onAudit={openAudit} />

      <div className="space-y-4 px-6 py-4">
        <section aria-label="Key performance indicators" className="grid grid-cols-4 gap-4">
          <KpiCard
            emphasis
            tone="danger"
            label="Total Docked Value"
            value={formatNaira(kpis.dockedValue, { compact: true })}
            caption={`Across ${location === 'all' ? locations.length : 1} ${location === 'all' ? 'locations' : 'location'}, ${scopedDates.length}d`}
            delta={kpis.dockedDelta.text}
            deltaDirection={kpis.dockedDelta.direction}
            deltaIsBad={kpis.dockedDelta.direction === 'up'}
          />
          <KpiCard
            tone="warn"
            label="Unrecorded Sales"
            value={formatNumber(kpis.undocked)}
            caption="Units sold, not in Xero"
            delta={kpis.undockedDelta.text}
            deltaDirection={kpis.undockedDelta.direction}
            deltaIsBad={kpis.undockedDelta.direction === 'up'}
          />
          <KpiCard
            tone="neutral"
            label="Discrepancies"
            value={String(kpis.discrepancies)}
            caption="SKUs off tolerance in window"
            delta={kpis.discrepancyDelta.text}
            deltaDirection={kpis.discrepancyDelta.direction}
          />
          <KpiCard
            tone="brand"
            label="Auto-Reorder Risk SKUs"
            value={String(kpis.atRisk)}
            caption="Reorder blocked by variance"
            delta={kpis.atRiskDelta.text}
            deltaDirection={kpis.atRiskDelta.direction}
          />
        </section>

        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-neutral-500">
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Slicers
          </span>
          <div className="h-5 w-px bg-neutral-200" aria-hidden="true" />
          <Select
            label="Location"
            value={location}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((item) => ({ value: item, label: item })),
            ]}
            onChange={setLocation}
          />
          <Select label="Date range" value={range} options={RANGE_OPTIONS} onChange={setRange} />
          <Select
            label="Category"
            value={category}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((item) => ({ value: item, label: item })),
            ]}
            onChange={setCategory}
          />
          <span className="num ml-auto text-2xs text-neutral-400">
            {filtered.length} of {allRows.length} SKU rows
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section aria-labelledby="variance-heading">
            <div className="flex items-baseline justify-between pb-2">
              <h2
                id="variance-heading"
                className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Variance by SKU
              </h2>
              <p className="text-2xs text-neutral-400">Flagged rows route to the audit queue</p>
            </div>
            {filtered.length > 0 ? (
              <VarianceTable records={filtered} flagged={flags} onToggleFlag={handleToggleFlag} />
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-xs text-neutral-500">
                No SKU rows match the current slicers.
              </div>
            )}
          </section>

          <div className="space-y-4">
            <DockedTrendChart points={trend} />
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Submission Status
              </h2>
              <ul className="mt-3 space-y-2.5">
                {submissionStatus.map((item) => (
                  <li key={item.location} className="flex items-center justify-between">
                    <span className="text-xs text-ink">{item.location} Warehouse</span>
                    {item.submittedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-[#00753A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                        Submitted{' '}
                        {new Date(item.submittedAt).toLocaleTimeString('en-GB', {
                          timeZone: 'Africa/Lagos',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-danger">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
                        Not started
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {auditOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink/30"
          role="dialog"
          aria-modal="true"
          aria-label="Audit trail"
          onClick={() => setAuditOpen(false)}
        >
          <div
            className="flex h-full w-[520px] flex-col border-l border-neutral-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
              <HistoryIcon className="h-4 w-4 text-brand" aria-hidden="true" />
              <h2 className="flex-1 text-sm font-semibold text-ink">Audit trail · latest 50</h2>
              <button
                type="button"
                onClick={() => setAuditOpen(false)}
                aria-label="Close audit trail"
                className="rounded p-1 text-neutral-400 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-ink"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {auditError ? (
                <ErrorView message={auditError} />
              ) : audit === null ? (
                <LoadingView label="Loading audit entries…" />
              ) : audit.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-neutral-500">
                  No audit entries recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {audit.map((entry, index) => (
                    <li
                      key={`${entry.Timestamp}-${index}`}
                      className="rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-brand-10 px-1.5 py-0.5 text-2xs font-semibold text-brand">
                          {entry.Action.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        <span className="num text-2xs text-neutral-500">
                          {new Date(entry.Timestamp).toLocaleString('en-GB', {
                            timeZone: 'Africa/Lagos',
                            day: 'numeric',
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-2xs text-neutral-600">
                        {entry.Actor_Email}
                        {entry.Date ? ` · ${entry.Date}` : ''}
                        {entry.Location ? ` · ${entry.Location}` : ''}
                      </p>
                      <p
                        className="mt-0.5 truncate text-2xs text-neutral-500"
                        title={entry.Details}
                      >
                        {entry.Details}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function Header({
  onExport,
  onAudit,
}: {
  onExport: () => void
  onAudit: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold text-ink">Executive Dashboard</h1>
          <p className="text-2xs text-neutral-500">Network-wide stock variance · WAT</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
          <Button variant="primary" size="sm" onClick={onAudit}>
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Open audit queue
          </Button>
        </div>
      </div>
    </header>
  )
}
