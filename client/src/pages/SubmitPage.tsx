import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDaysIcon, CheckCircle2Icon, MapPinIcon, RefreshCwIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { LoadingView } from '../components/ui/StateViews'
import { CountdownChip } from '../components/submission/CountdownChip'
import { Dropzone } from '../components/submission/Dropzone'
import { NoteModal } from '../components/submission/NoteModal'
import { SubmissionTable } from '../components/submission/SubmissionTable'
import { SummaryBar } from '../components/submission/SummaryBar'
import type { SkuMappingEntry, StatusResult, SubmitResult } from '../lib/apiTypes'
import { errorMessage, isErrorCode } from '../lib/errors'
import { formatNaira, formatNumber, formatDateLabel } from '../lib/format'
import {
  buildPreviewRows,
  computePreviewRow,
  summarizePreview,
  type ComputedPreviewRow,
  type PreviewRow,
} from '../lib/recon'
import { isSubmissionOpen, lagosClockLabel, lagosDateString } from '../lib/wat'
import {
  parseLeverEdgeFile,
  parsePhysicalFile,
  parseXeroFile,
  type LeverEdgeItemRow,
  type PhysicalItemRow,
  type XeroItemRow,
} from '../lib/xlsx'

interface UploadedSource {
  file: File
  meta: string
}

function draftKey(date: string, location: string): string {
  return `renuzi.draft.${date}.${location.toLowerCase()}`
}

interface DraftShape {
  counts: Record<string, { cs: number; dz: number; pc: number }>
  notes: Record<string, string>
}

export default function SubmitPage() {
  const { user, api } = useAuth()
  const { toast } = useToast()
  const today = useMemo(() => lagosDateString(), [])

  const [location, setLocation] = useState(user?.location ?? '')
  const [locations, setLocations] = useState<string[]>(user?.location ? [user.location] : [])
  const [mappings, setMappings] = useState<SkuMappingEntry[]>([])
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [locked, setLocked] = useState(() => !isSubmissionOpen(lagosDateString()))
  const [leveredge, setLeveredge] = useState<UploadedSource | null>(null)
  const [xero, setXero] = useState<UploadedSource | null>(null)
  const [physical, setPhysical] = useState<UploadedSource | null>(null)
  const [leveredgeIssues, setLeveredgeIssues] = useState<string[] | null>(null)
  const [xeroIssues, setXeroIssues] = useState<string[] | null>(null)
  const [physicalIssues, setPhysicalIssues] = useState<string[] | null>(null)
  const [busyField, setBusyField] = useState<'leveredge' | 'xero' | 'physical' | null>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [noteSku, setNoteSku] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const managerLockedLocation = user?.role === 'warehouse_manager'

  // Locations for admins (managers are pinned to their own warehouse).
  useEffect(() => {
    if (managerLockedLocation || !location) return
    api
      .listLocations()
      .then((all) => {
        setLocations(all.length > 0 ? all : ['Ketu', 'Lekki'])
        setLocation((current) => current || all[0] || 'Ketu')
      })
      .catch(() => setLocations(['Ketu', 'Lekki']))
  }, [api, managerLockedLocation, location])

  // Mapping factors for live unit conversion (managers may lack access live-side;
  // the engine then falls back to default factors — same as the server).
  useEffect(() => {
    api
      .listMappings()
      .then(setMappings)
      .catch(() => setMappings([]))
  }, [api])

  const loadStatus = useCallback(() => {
    if (!location) return
    setStatusLoading(true)
    setStatusError(null)
    api
      .getReconciliationStatus(today, location)
      .then(setStatus)
      .catch((error) => setStatusError(errorMessage(error)))
      .finally(() => setStatusLoading(false))
  }, [api, today, location])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Tick the cutoff lock while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLocked(!isSubmissionOpen(lagosDateString()))
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const computed = useMemo(() => rows.map(computePreviewRow), [rows])
  const totals = useMemo(() => summarizePreview(computed), [computed])
  const missingNotes = computed.filter((row) => row.noteRequired && !row.note).length
  const noteRow = computed.find((row) => row.sku === noteSku) ?? null

  // ----- file handling ------------------------------------------------------

  const parsedRef = useRef<{
    leveredge: LeverEdgeItemRow[]
    xero: XeroItemRow[]
    physical: PhysicalItemRow[]
  }>({ leveredge: [], xero: [], physical: [] })

  const rebuildRows = useCallback(
    (loc: string, map: SkuMappingEntry[]) => {
      const parsed = parsedRef.current
      if (parsed.leveredge.length === 0 && parsed.xero.length === 0) {
        setRows([])
        return
      }
      const xeroForLocation = parsed.xero.filter(
        (row) => row.location.toLowerCase() === loc.toLowerCase()
      )
      const fresh = buildPreviewRows(
        { leveredge: parsed.leveredge, xero: xeroForLocation, physical: parsed.physical },
        map
      )
      // Restore any locally saved draft counts/notes for this date+location.
      try {
        const raw = localStorage.getItem(draftKey(today, loc))
        if (raw) {
          const draft = JSON.parse(raw) as DraftShape
          for (const row of fresh) {
            const count = draft.counts[row.sku]
            if (count) {
              row.cs = count.cs
              row.dz = count.dz
              row.pc = count.pc
            }
            if (draft.notes[row.sku]) row.note = draft.notes[row.sku]
          }
        }
      } catch {
        // ignore malformed drafts
      }
      setRows(fresh)
    },
    [today]
  )

  async function handleFile(field: 'leveredge' | 'xero' | 'physical', file: File): Promise<void> {
    setBusyField(field)
    try {
      if (field === 'leveredge') {
        const parsed = await parseLeverEdgeFile(file)
        parsedRef.current.leveredge = parsed.rows
        setLeveredge({ file, meta: `${formatNumber(parsed.rows.length)} rows parsed` })
        setLeveredgeIssues(null)
      } else if (field === 'xero') {
        const parsed = await parseXeroFile(file)
        parsedRef.current.xero = parsed.rows
        const loc = location || ''
        const scoped = loc
          ? parsed.rows.filter((row) => row.location.toLowerCase() === loc.toLowerCase())
          : parsed.rows
        setXero({
          file,
          meta: `${formatNumber(parsed.rows.length)} rows parsed · ${formatNumber(scoped.length)} for ${loc || 'this location'}`,
        })
        setXeroIssues(null)
      } else {
        const parsed = await parsePhysicalFile(file)
        parsedRef.current.physical = parsed.rows
        setPhysical({
          file,
          meta: `${formatNumber(parsed.rows.length)} count rows · CS/DZ/PC prefilled below`,
        })
        setPhysicalIssues(null)
      }
      if (location) rebuildRows(location, mappings)
    } catch (error) {
      const issues = (error as { issues?: string[] }).issues ?? [errorMessage(error)]
      if (field === 'leveredge') setLeveredgeIssues(issues)
      else if (field === 'xero') setXeroIssues(issues)
      else setPhysicalIssues(issues)
      toast(
        `${field === 'leveredge' ? 'LeverEdge' : field === 'xero' ? 'Xero' : 'Physical count'} file rejected — check the columns listed.`,
        'error'
      )
    } finally {
      setBusyField(null)
    }
  }

  function clearField(field: 'leveredge' | 'xero' | 'physical') {
    if (field === 'leveredge') {
      setLeveredge(null)
      setLeveredgeIssues(null)
      parsedRef.current.leveredge = []
    } else if (field === 'xero') {
      setXero(null)
      setXeroIssues(null)
      parsedRef.current.xero = []
    } else {
      setPhysical(null)
      setPhysicalIssues(null)
      parsedRef.current.physical = []
    }
    if (location) rebuildRows(location, mappings)
  }

  // Rebuild when admin switches location or mappings load late.
  useEffect(() => {
    if (location) rebuildRows(location, mappings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, mappings])

  // Autosave draft counts (debounced).
  useEffect(() => {
    if (rows.length === 0 || !location) return
    const timer = window.setTimeout(() => {
      const draft: DraftShape = { counts: {}, notes: {} }
      for (const row of rows) {
        draft.counts[row.sku] = { cs: row.cs, dz: row.dz, pc: row.pc }
        if (row.note) draft.notes[row.sku] = row.note
      }
      localStorage.setItem(draftKey(today, location), JSON.stringify(draft))
      setDraftSavedAt(lagosClockLabel())
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [rows, today, location])

  // ----- editing ------------------------------------------------------------

  function handleCountChange(sku: string, field: 'cs' | 'dz' | 'pc', value: number) {
    setRows((current) => current.map((row) => (row.sku === sku ? { ...row, [field]: value } : row)))
  }

  function saveNote(sku: string, note: string) {
    setRows((current) => current.map((row) => (row.sku === sku ? { ...row, note } : row)))
    setNoteSku(null)
    toast('Variance note saved', 'success')
  }

  function saveDraftNow() {
    if (!location || rows.length === 0) return
    const draft: DraftShape = { counts: {}, notes: {} }
    for (const row of rowsRef.current) {
      draft.counts[row.sku] = { cs: row.cs, dz: row.dz, pc: row.pc }
      if (row.note) draft.notes[row.sku] = row.note
    }
    localStorage.setItem(draftKey(today, location), JSON.stringify(draft))
    setDraftSavedAt(lagosClockLabel())
    toast('Draft saved locally', 'success')
  }

  // ----- submit -------------------------------------------------------------

  async function handleSubmit() {
    if (!location || !leveredge || !xero) return
    setSubmitting(true)
    try {
      const payload = await api.submitReconciliation({
        leveredge: leveredge.file,
        xero: xero.file,
        physical: physical?.file ?? null,
        counts: {
          date: today,
          location,
          rows: rowsRef.current.map((row) => ({
            sku: row.sku,
            cs: row.cs,
            dz: row.dz,
            pc: row.pc,
            notes: row.note || null,
          })),
        },
      })
      setResult(payload)
      localStorage.removeItem(draftKey(today, location))
      toast('Daily submission recorded', 'success')
      loadStatus()
    } catch (error) {
      if (isErrorCode(error, 'LOCKED_FOR_AUDIT')) {
        setLocked(true)
        toast('Locked for Executive Audit — edits are closed for today.', 'error')
        loadStatus()
      } else {
        toast(errorMessage(error), 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ----- locked view rows (from the audit-frozen submission) -----------------

  const lockedRows: ComputedPreviewRow[] = useMemo(() => {
    if (!locked || !status || status.rows.length === 0) return []
    return status.rows.map((row) => ({
      sku: row.SKU_Code,
      name: row.Item_Name,
      leverEdgeQty: row.LeverEdge_Qty,
      xeroQty: row.Xero_Qty,
      cs: row.Physical_CS ?? 0,
      dz: row.Physical_DZ ?? 0,
      pc: row.Physical_PC ?? 0,
      csFactor: 1,
      dzFactor: 12,
      unitPrice: row.Unit_Price_NGN,
      fromPhysical: row.Physical_Units !== null,
      unmapped: row.Status === 'Unmapped',
      needsReview: row.Needs_Review,
      note: row.Notes,
      physicalUnits: row.Physical_Units ?? 0,
      docked: row.Docked_Qty ?? 0,
      undocked: row.Undocked_Qty ?? 0,
      totalVariance: row.Total_Variance ?? 0,
      status: row.Status,
      noteRequired: false,
    }))
  }, [locked, status])

  const filesReady = Boolean(leveredge && xero && rows.length > 0)
  const submittedAt = status?.rows.find((row) => row.Submitted_At !== null)?.Submitted_At ?? null

  if (!user) return null

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
            {managerLockedLocation ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-10 px-2.5 py-1.5 text-xs font-semibold text-brand">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {location} Warehouse
              </span>
            ) : (
              <Select
                label="Warehouse"
                value={location}
                options={locations.map((item) => ({ value: item, label: item }))}
                onChange={setLocation}
              />
            )}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
              <CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDateLabel(today)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {draftSavedAt ? (
              <span className="flex items-center gap-1.5 text-2xs text-neutral-400">
                <RefreshCwIcon className="h-3 w-3" aria-hidden="true" />
                Autosaved {draftSavedAt}
              </span>
            ) : null}
            <CountdownChip />
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 px-6 py-4">
        {result ? (
          <section
            aria-labelledby="submit-success"
            className="rounded-lg border border-success-25 bg-success-10 p-5"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="h-5 w-5 text-success" aria-hidden="true" />
              <h2 id="submit-success" className="text-sm font-semibold text-ink">
                Submission recorded for {result.location} · {formatDateLabel(result.date)}
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-3">
              <div className="rounded-md border border-success-25 bg-white px-3 py-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                  Total Docked Value
                </p>
                <p className="num mt-0.5 text-lg font-semibold text-danger">
                  {formatNaira(result.summary.dockedValueNGN)}
                </p>
              </div>
              <div className="rounded-md border border-success-25 bg-white px-3 py-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                  Unrecorded Sales
                </p>
                <p className="num mt-0.5 text-lg font-semibold text-[#9A6A28]">
                  {formatNumber(result.summary.undockedQty)}
                </p>
              </div>
              <div className="rounded-md border border-success-25 bg-white px-3 py-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                  Matched
                </p>
                <p className="num mt-0.5 text-lg font-semibold text-[#00753A]">
                  {result.summary.matched}
                </p>
              </div>
              <div className="rounded-md border border-success-25 bg-white px-3 py-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                  Discrepancies
                </p>
                <p className="num mt-0.5 text-lg font-semibold text-[#C22F30]">
                  {result.summary.discrepancy}
                </p>
              </div>
              <div className="rounded-md border border-success-25 bg-white px-3 py-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                  At-Risk / Unmapped
                </p>
                <p className="num mt-0.5 text-lg font-semibold text-ink">
                  {result.summary.atRiskSkus} / {result.summary.unmapped}
                </p>
              </div>
            </div>
            <p className="mt-3 text-2xs text-neutral-600">
              Replaced {result.replacedRows} previous row{result.replacedRows === 1 ? '' : 's'} ·
              parsed {result.parsed.leveredge} LeverEdge · {result.parsed.xero} Xero ·{' '}
              {result.parsed.physical} physical · {result.parsed.manualCounts} manual counts.
              Resubmitting before 6:00 PM WAT replaces this snapshot.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                Back to count table
              </Button>
            </div>
          </section>
        ) : null}

        {statusLoading ? (
          <LoadingView label="Checking today's submission…" />
        ) : statusError ? (
          <p className="rounded-lg border border-warn-25 bg-warn-10 px-4 py-2 text-xs text-[#9A6A28]">
            {statusError}
          </p>
        ) : status && status.rowCount > 0 && submittedAt ? (
          <p className="rounded-lg border border-brand-25 bg-brand-10 px-4 py-2 text-xs text-brand">
            Today&apos;s submission is on record ({status.rowCount} rows, submitted{' '}
            {new Date(submittedAt).toLocaleTimeString('en-GB', {
              timeZone: 'Africa/Lagos',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            WAT){locked ? ' and locked for executive audit.' : ' — resubmitting replaces it.'}
          </p>
        ) : null}

        <section aria-labelledby="uploads-heading">
          <div className="flex items-baseline justify-between">
            <h2
              id="uploads-heading"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Source Exports
            </h2>
            <p className="text-2xs text-neutral-400">.xlsx or .csv · max 20 MB each</p>
          </div>
          <div
            className={`mt-2 grid grid-cols-2 gap-4 ${locked ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Dropzone
              title="LeverEdge Export"
              hint="System stock movement for the selected day"
              uploadedFile={leveredge?.file.name}
              uploadedMeta={leveredge?.meta}
              issues={leveredgeIssues ?? undefined}
              busy={busyField === 'leveredge'}
              onFile={(file) => void handleFile('leveredge', file)}
              onClear={() => clearField('leveredge')}
            />
            <Dropzone
              title="Xero Export"
              hint="Drag the invoiced sales export here (one sheet per warehouse)"
              uploadedFile={xero?.file.name}
              uploadedMeta={xero?.meta}
              issues={xeroIssues ?? undefined}
              busy={busyField === 'xero'}
              onFile={(file) => void handleFile('xero', file)}
              onClear={() => clearField('xero')}
            />
          </div>
          <div className={`mt-3 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
            <Dropzone
              compact
              optional
              title="Physical Count File"
              hint="Upload a scanned count sheet to prefill CS / DZ / PC below"
              uploadedFile={physical?.file.name}
              uploadedMeta={physical?.meta}
              issues={physicalIssues ?? undefined}
              busy={busyField === 'physical'}
              onFile={(file) => void handleFile('physical', file)}
              onClear={() => clearField('physical')}
            />
          </div>
        </section>

        <section aria-labelledby="count-heading">
          <div className="flex items-baseline justify-between">
            <h2
              id="count-heading"
              className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              {locked && lockedRows.length > 0
                ? `Locked Submission · ${lockedRows.length} SKUs`
                : `Physical Count · ${rows.length} SKUs`}
            </h2>
            <p className="text-2xs text-neutral-400">
              Variance ≥ 10 units requires a note before submission
            </p>
          </div>
          <div className="mt-2">
            {locked && lockedRows.length > 0 ? (
              <SubmissionTable
                rows={lockedRows}
                locked
                onCountChange={() => undefined}
                onOpenNote={() => undefined}
              />
            ) : locked ? (
              <div className="rounded-lg border border-danger-25 bg-danger-10 px-4 py-8 text-center text-xs text-[#C22F30]">
                No submission is on record for today and the 6:00 PM WAT cutoff has passed — the day
                is locked for executive audit.
              </div>
            ) : (
              <SubmissionTable
                rows={computed}
                locked={false}
                onCountChange={handleCountChange}
                onOpenNote={setNoteSku}
              />
            )}
          </div>
        </section>
      </div>

      {!locked && !result ? (
        <SummaryBar
          dockedValue={totals.dockedValue}
          unrecordedSales={totals.unrecordedSales}
          atRiskSkus={totals.atRiskSkus}
          missingNotes={missingNotes}
          locked={locked}
          submitting={submitting}
          filesReady={filesReady}
          onSaveDraft={saveDraftNow}
          onSubmit={() => void handleSubmit()}
        />
      ) : null}

      <NoteModal row={noteRow} onSave={saveNote} onClose={() => setNoteSku(null)} />
    </main>
  )
}
