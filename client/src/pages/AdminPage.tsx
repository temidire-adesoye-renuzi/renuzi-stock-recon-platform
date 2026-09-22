import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckIcon,
    PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { ErrorView, LoadingView } from '../components/ui/StateViews'
import { UnmappedQueue } from '../components/admin/UnmappedQueue'
import type { SkuMappingEntry, UnmappedSku } from '../lib/apiTypes'
import { ApiError } from '../lib/apiTypes'
import { errorMessage } from '../lib/errors'

type EditableField = 'leverEdgeItemName' | 'xeroItemCode' | 'xeroItemName' | 'csFactor' | 'dzFactor' | 'category'

const headCell =
  'sticky top-0 z-10 bg-brand-10 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-brand'

const emptyDraft = {
  leverEdgeSkuCode: '',
  leverEdgeItemName: '',
  xeroItemCode: '',
  xeroItemName: '',
  csFactor: '1',
  dzFactor: '12',
  category: '',
}

export default function AdminPage() {
  const { api } = useAuth()
  const { toast } = useToast()

  const [mappings, setMappings] = useState<SkuMappingEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [unmapped, setUnmapped] = useState<UnmappedSku[]>([])
  const [queueBusy, setQueueBusy] = useState<string | null>(null)

  const [editing, setEditing] = useState<{ code: string; field: EditableField } | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [createError, setCreateError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoadError(null)
    Promise.all([api.listMappings(), api.listUnmappedSkus().catch(() => [] as UnmappedSku[])])
      .then(([list, queue]) => {
        setMappings(list)
        setUnmapped(queue)
      })
      .catch((error) => setLoadError(errorMessage(error)))
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (mappings === null) return []
    const term = query.trim().toLowerCase()
    if (!term) return mappings
    return mappings.filter((row) =>
      [
        row.leverEdgeSkuCode,
        row.leverEdgeItemName,
        row.xeroItemCode,
        row.xeroItemName,
        row.category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [mappings, query])

  // ----- inline editing -----------------------------------------------------

  function startEdit(code: string, field: EditableField, value: string | number) {
    setEditing({ code, field })
    setEditDraft(String(value))
  }

  async function commitEdit() {
    if (!editing) return
    const entry = mappings?.find((row) => row.leverEdgeSkuCode === editing.code)
    if (!entry) return
    let patch: Partial<SkuMappingEntry>
    if (editing.field === 'csFactor' || editing.field === 'dzFactor') {
      const parsed = Number(editDraft)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast(`${editing.field === 'csFactor' ? 'CS' : 'DZ'} factor must be a positive number`, 'error')
        setEditing(null)
        return
      }
      patch = { [editing.field]: parsed }
    } else {
      patch = { [editing.field]: editDraft.trim() }
    }
    setSavingEdit(true)
    try {
      const updated = await api.updateMapping(editing.code, patch)
      setMappings((current) =>
        (current ?? []).map((row) =>
          row.leverEdgeSkuCode === updated.leverEdgeSkuCode ? updated : row,
        ),
      )
      toast(`Mapping ${editing.code} updated`, 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setSavingEdit(false)
      setEditing(null)
    }
  }

  async function toggleActive(entry: SkuMappingEntry) {
    setRowBusy(entry.leverEdgeSkuCode)
    try {
      const updated = await api.updateMapping(entry.leverEdgeSkuCode, {
        active: !entry.active,
      })
      setMappings((current) =>
        (current ?? []).map((row) =>
          row.leverEdgeSkuCode === updated.leverEdgeSkuCode ? updated : row,
        ),
      )
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setRowBusy(null)
    }
  }

  async function removeMapping(entry: SkuMappingEntry) {
    if (!window.confirm(`Delete the mapping for ${entry.leverEdgeSkuCode}? This cannot be undone.`)) {
      return
    }
    setRowBusy(entry.leverEdgeSkuCode)
    try {
      await api.deleteMapping(entry.leverEdgeSkuCode)
      setMappings((current) =>
        (current ?? []).filter((row) => row.leverEdgeSkuCode !== entry.leverEdgeSkuCode),
      )
      toast(`Mapping ${entry.leverEdgeSkuCode} deleted`, 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setRowBusy(null)
    }
  }

  // ----- unmapped queue -----------------------------------------------------

  async function acceptSuggestion(item: UnmappedSku) {
    setQueueBusy(item.id)
    try {
      await api.resolveUnmappedSku(item)
      setUnmapped((current) => current.filter((candidate) => candidate.id !== item.id))
      const list = await api.listMappings()
      setMappings(list)
      toast(`Mapping created for ${item.sourceCode}`, 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setQueueBusy(null)
    }
  }

  async function dismissSuggestion(item: UnmappedSku) {
    setQueueBusy(item.id)
    try {
      await api.dismissUnmappedSku(item.id)
      setUnmapped((current) => current.filter((candidate) => candidate.id !== item.id))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setQueueBusy(null)
    }
  }

  // ----- create + import ----------------------------------------------------

  async function createMapping() {
    setCreateError(null)
    const csFactor = Number(draft.csFactor)
    const dzFactor = Number(draft.dzFactor)
    if (draft.leverEdgeSkuCode.trim() === '') {
      setCreateError('LeverEdge SKU code is required.')
      return
    }
    if (!Number.isFinite(csFactor) || csFactor <= 0 || !Number.isFinite(dzFactor) || dzFactor <= 0) {
      setCreateError('CS and DZ factors must be positive numbers.')
      return
    }
    try {
      const created = await api.createMapping({
        leverEdgeSkuCode: draft.leverEdgeSkuCode.trim(),
        leverEdgeItemName: draft.leverEdgeItemName.trim(),
        xeroItemCode: draft.xeroItemCode.trim(),
        xeroItemName: draft.xeroItemName.trim(),
        csFactor,
        dzFactor,
        category: draft.category.trim(),
        active: true,
      })
      setMappings((current) => [...(current ?? []), created])
      setCreating(false)
      setDraft(emptyDraft)
      toast(`Mapping ${created.leverEdgeSkuCode} created`, 'success')
    } catch (error) {
      setCreateError(
        error instanceof ApiError && error.code === 'SKU_MAPPING_EXISTS'
          ? 'A mapping with that LeverEdge code already exists.'
          : errorMessage(error),
      )
    }
  }

  async function importCsv(file: File) {
    setImporting(true)
    try {
      const result = await api.importMappings(file)
      toast(
        `CSV import: ${result.created} created, ${result.updated} updated (${result.total} total)` +
          (result.errors.length > 0 ? ` · ${result.errors.length} rows skipped` : ''),
        result.errors.length > 0 ? 'info' : 'success',
      )
      const list = await api.listMappings()
      setMappings(list)
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const inputClass =
    'h-7 w-full rounded border border-brand-50 bg-white px-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

  function editableCell(entry: SkuMappingEntry, field: EditableField, value: string, numeric = false) {
    const isEditing = editing?.code === entry.leverEdgeSkuCode && editing.field === field
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type={numeric ? 'number' : 'text'}
            value={editDraft}
            disabled={savingEdit}
            onChange={(event) => setEditDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void commitEdit()
              if (event.key === 'Escape') setEditing(null)
            }}
            className={`${inputClass} ${numeric ? 'num w-16 text-right' : 'min-w-[140px]'}`}
          />
          <button
            type="button"
            onClick={() => void commitEdit()}
            disabled={savingEdit}
            aria-label="Save"
            className="rounded p-1 text-success transition-colors duration-150 ease-out hover:bg-success-10 disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            aria-label="Cancel"
            className="rounded p-1 text-neutral-400 transition-colors duration-150 ease-out hover:bg-neutral-100"
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )
    }
    return (
      <button
        type="button"
        disabled={rowBusy === entry.leverEdgeSkuCode}
        onClick={() => startEdit(entry.leverEdgeSkuCode, field, value)}
        title="Click to edit"
        className={`group/cell inline-flex items-center gap-1 rounded px-0.5 text-left transition-colors duration-150 ease-out hover:bg-brand-10/60 disabled:opacity-50 ${
          numeric ? 'num' : ''
        }`}
      >
        <span>{value}</span>
        <PencilIcon
          className="h-3 w-3 shrink-0 text-neutral-300 group-hover/cell:text-brand"
          aria-hidden="true"
        />
      </button>
    )
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
          <div className="ml-auto flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importCsv(file)
                event.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <UploadIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {importing ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              New mapping
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-6 py-4">
        {loadError ? (
          <ErrorView message={loadError} onRetry={load} />
        ) : (
          <>
            <UnmappedQueue
              items={unmapped}
              busyId={queueBusy}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />

            <section aria-labelledby="mapping-heading">
              <div className="flex items-center justify-between pb-2">
                <h2
                  id="mapping-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Active Mappings · {filtered.length}
                </h2>
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Search mappings"
                    placeholder="Search code, name or category"
                    className="h-8 w-72 rounded-md border border-neutral-300 bg-white pl-8 pr-3 text-xs text-ink transition-colors duration-150 ease-out placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="max-h-[480px] overflow-auto">
                  {mappings === null ? (
                    <div className="p-4">
                      <LoadingView label="Loading mappings…" />
                    </div>
                  ) : (
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
                          <th scope="col" className={`${headCell} text-center`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row, index) => (
                          <tr
                            key={row.leverEdgeSkuCode}
                            className={`border-b border-neutral-100 last:border-b-0 ${
                              index % 2 === 1 ? 'bg-neutral-50/60' : 'bg-white'
                            } ${row.active ? '' : 'text-neutral-400'}`}
                          >
                            <td className="num px-3 py-2 font-medium">{row.leverEdgeSkuCode}</td>
                            <td className="px-3 py-2">
                              {editableCell(row, 'leverEdgeItemName', row.leverEdgeItemName)}
                            </td>
                            <td className="num px-3 py-2 font-medium text-brand">
                              {editableCell(row, 'xeroItemCode', row.xeroItemCode)}
                            </td>
                            <td className="px-3 py-2">
                              {editableCell(row, 'xeroItemName', row.xeroItemName)}
                            </td>
                            <td className="num px-3 py-2 text-right">
                              <div className="flex justify-end">
                                {editableCell(row, 'csFactor', String(row.csFactor), true)}
                              </div>
                            </td>
                            <td className="num px-3 py-2 text-right">
                              <div className="flex justify-end">
                                {editableCell(row, 'dzFactor', String(row.dzFactor), true)}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {editableCell(row, 'category', row.category)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={row.active}
                                aria-label={`Toggle mapping ${row.leverEdgeSkuCode}`}
                                disabled={rowBusy === row.leverEdgeSkuCode}
                                onClick={() => void toggleActive(row)}
                                className={`relative inline-flex items-center rounded-full transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 disabled:opacity-50 ${
                                  row.active ? 'bg-success' : 'bg-neutral-300'
                                }`}
                                style={{ height: 18, width: 32 }}
                              >
                                <span
                                  className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ease-out"
                                  style={{ transform: `translateX(${row.active ? 16 : 2}px)` }}
                                />
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => void removeMapping(row)}
                                disabled={rowBusy === row.leverEdgeSkuCode}
                                aria-label={`Delete mapping ${row.leverEdgeSkuCode}`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-400 transition-colors duration-150 ease-out hover:border-danger-25 hover:bg-danger-10 hover:text-danger disabled:opacity-50"
                              >
                                <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-3 py-10 text-center text-xs text-neutral-500">
                              No mappings match &ldquo;{query}&rdquo;.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <p className="mt-2 text-2xs text-neutral-400">
                CSV import headers: LeverEdge_SKU_Code, LeverEdge_Item_Name, Xero_Item_Code,
                Xero_Item_Name, CS_Factor, DZ_Factor, Category, Active
              </p>
            </section>
          </>
        )}
      </div>

      {creating ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-mapping-title"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_12px_32px_-12px_rgba(17,17,17,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 id="new-mapping-title" className="text-sm font-semibold text-ink">
                New SKU mapping
              </h2>
              <p className="mt-0.5 text-2xs text-neutral-500">
                Links a LeverEdge item code to its Xero item with CS/DZ conversion factors.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {(
                [
                  ['leverEdgeSkuCode', 'LeverEdge code *'],
                  ['leverEdgeItemName', 'LeverEdge item name'],
                  ['xeroItemCode', 'Xero item code'],
                  ['xeroItemName', 'Xero item name'],
                  ['csFactor', 'CS factor'],
                  ['dzFactor', 'DZ factor'],
                  ['category', 'Category'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-xs font-medium text-ink">
                  {label}
                  <input
                    type={field === 'csFactor' || field === 'dzFactor' ? 'number' : 'text'}
                    value={draft[field]}
                    onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                    className={`mt-1 h-8 w-full rounded-md border border-neutral-300 px-2.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                      field === 'csFactor' || field === 'dzFactor' ? 'num' : ''
                    }`}
                  />
                </label>
              ))}
            </div>
            {createError ? (
              <p role="alert" className="mx-5 mb-3 rounded-md border border-danger-25 bg-danger-10 px-3 py-2 text-xs text-[#C22F30]">
                {createError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button variant="accent" size="sm" onClick={() => void createMapping()}>
                Create mapping
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
