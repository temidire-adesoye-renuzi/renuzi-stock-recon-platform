import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { isSubmissionOpen } from '../services/cutoff.js'
import { parseLeverEdge } from '../services/parsers/leveredge.js'
import { parseXero } from '../services/parsers/xero.js'
import { parsePhysical } from '../services/parsers/physical.js'
import { reconcile, summarizeRows } from '../services/reconciliation.js'
import { listMappings } from '../services/skuMapService.js'
import {
  AUDITLOG_SHEET,
  RECONCILIATION_SHEET,
  reconRowToCells,
  tableRowToReconRow,
  type AuditLogEntry,
  type PhysicalItemRow,
} from '../services/schema.js'
import {
  getStorage,
  storageReady,
  storageTransaction,
} from '../services/storage/index.js'
import { requireAuth, requireLocation, requireRole } from '../middleware/auth.js'

/**
 * Reconciliation API.
 *
 *  POST /api/v1/reconciliation/submit — multipart submit of the daily exports
 *  GET  /api/v1/reconciliation/status — submitted rows + lock state
 */

export const reconciliationRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
})
const uploadFields = upload.fields([
  { name: 'leveredge', maxCount: 1 },
  { name: 'xero', maxCount: 1 },
  { name: 'physical', maxCount: 1 },
])

interface ManualCountRow {
  sku: string
  cs: number | null
  dz: number | null
  pc: number | null
  notes: string | null
}

interface ParsedCounts {
  date: string
  location: string
  rows: ManualCountRow[]
  notes: string | null
}

function parseManualCounts(raw: unknown): { ok: true; counts: ParsedCounts } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : '')
  } catch {
    return { ok: false, error: 'INVALID_COUNTS_JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, error: 'INVALID_COUNTS_JSON' }
  const body = parsed as Record<string, unknown>

  const date = typeof body.date === 'string' ? body.date.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'INVALID_COUNTS_DATE' }
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  if (location === '') return { ok: false, error: 'INVALID_COUNTS_LOCATION' }
  if (!Array.isArray(body.rows)) return { ok: false, error: 'INVALID_COUNTS_ROWS' }

  const rows: ManualCountRow[] = []
  for (const entry of body.rows) {
    if (typeof entry !== 'object' || entry === null) return { ok: false, error: 'INVALID_COUNTS_ROWS' }
    const row = entry as Record<string, unknown>
    const sku = typeof row.sku === 'string' ? row.sku.trim() : ''
    if (sku === '') return { ok: false, error: 'INVALID_COUNTS_ROWS' }
    const numberOrNull = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') return null
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    }
    rows.push({
      sku,
      cs: numberOrNull(row.cs),
      dz: numberOrNull(row.dz),
      pc: numberOrNull(row.pc),
      notes: typeof row.notes === 'string' && row.notes.trim() !== '' ? row.notes.trim() : null,
    })
  }
  const notes = typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes.trim() : null
  return { ok: true, counts: { date, location, rows, notes } }
}

/** Merge manual counts over the parsed physical rows (manual wins per SKU). */
function mergeManualCounts(
  physical: PhysicalItemRow[],
  manual: ManualCountRow[],
  location: string
): { merged: PhysicalItemRow[]; notesBySku: Map<string, string> } {
  const notesBySku = new Map<string, string>()
  const merged = physical.map((row) => ({ ...row }))
  const bySku = new Map(merged.map((row) => [row.sku, row]))
  for (const count of manual) {
    const existing = bySku.get(count.sku)
    if (existing) {
      if (count.cs !== null) existing.cs = count.cs
      if (count.dz !== null) existing.dz = count.dz
      if (count.pc !== null) existing.pc = count.pc
    } else {
      const fresh: PhysicalItemRow = {
        sku: count.sku,
        name: '',
        cs: count.cs ?? 0,
        dz: count.dz ?? 0,
        pc: count.pc ?? 0,
        unitPrice: null,
        location,
      }
      merged.push(fresh)
      bySku.set(count.sku, fresh)
    }
    if (count.notes) notesBySku.set(count.sku, count.notes)
  }
  return { merged, notesBySku }
}

interface MulterFiles {
  [field: string]: Express.Multer.File[]
}

function firstFile(files: MulterFiles | undefined, field: string): Express.Multer.File | undefined {
  return files?.[field]?.[0]
}

async function handleSubmit(req: Request, res: Response): Promise<void> {
  const files = req.files as MulterFiles | undefined
  const leveredgeFile = firstFile(files, 'leveredge')
  const xeroFile = firstFile(files, 'xero')
  const physicalFile = firstFile(files, 'physical')

  if (!leveredgeFile || !xeroFile) {
    res.status(400).json({ error: 'MISSING_FILES', required: ['leveredge', 'xero'] })
    return
  }

  const parsedCounts = parseManualCounts(req.body.counts)
  if (!parsedCounts.ok) {
    res.status(400).json({ error: parsedCounts.error })
    return
  }
  const { date, location } = parsedCounts.counts

  // Role check passed in the middleware chain; managers may only submit for
  // their own warehouse (mirrors requireLocation for multipart bodies).
  if (req.user?.role === 'warehouse_manager') {
    const own = req.user.location?.toLowerCase()
    if (!own || own !== location.toLowerCase()) {
      res.status(403).json({ error: 'LOCATION_FORBIDDEN' })
      return
    }
  }

  // Daily cutoff lock (the global middleware cannot see multipart bodies).
  if (!isSubmissionOpen(date)) {
    res.status(403).json({ error: 'LOCKED_FOR_AUDIT' })
    return
  }

  let leveredge
  let xeroAll
  let physical
  try {
    leveredge = parseLeverEdge(leveredgeFile.buffer)
    xeroAll = parseXero(xeroFile.buffer)
    physical = physicalFile ? parsePhysical(physicalFile.buffer) : []
  } catch (error) {
    res.status(422).json({ error: 'UNPARSABLE_FILE', message: (error as Error).message })
    return
  }

  const xero = xeroAll.filter((row) => row.location.toLowerCase() === location.toLowerCase())
  const { merged: physicalMerged, notesBySku } = mergeManualCounts(
    physical,
    parsedCounts.counts.rows,
    location
  )

  await storageReady()
  const mapping = await listMappings()

  const reconciliationRows = reconcile({
    date,
    location,
    leveredge,
    xero,
    physical: physicalMerged,
    mapping,
    managerId: req.user?.id ?? null,
    submittedAt: new Date().toISOString(),
    notes: parsedCounts.counts.notes,
  })
  for (const row of reconciliationRows) {
    const manualNote = notesBySku.get(row.SKU_Code)
    if (manualNote) row.Notes = row.Notes === '' ? `Manual: ${manualNote}` : `${row.Notes}; Manual: ${manualNote}`
  }
  const summary = summarizeRows(reconciliationRows)

  const storage = getStorage()
  const replacedRows = await storageTransaction(async () => {
    // Idempotency: replace any previous submission for the same date+location.
    const removed = await storage.deleteRows(
      RECONCILIATION_SHEET,
      (row) => String(row.Date) === date && String(row.Location).toLowerCase() === location.toLowerCase()
    )
    await storage.appendRows(
      RECONCILIATION_SHEET,
      reconciliationRows.map(reconRowToCells)
    )
    const audit: AuditLogEntry = {
      Timestamp: new Date().toISOString(),
      Actor_ID: req.user?.id ?? 'unknown',
      Actor_Email: req.user?.email ?? 'unknown',
      Action: 'SUBMIT_RECONCILIATION',
      Date: date,
      Location: location,
      Details: JSON.stringify({
        replacedRows: removed,
        rowCount: summary.rowCount,
        matched: summary.matched,
        discrepancy: summary.discrepancy,
        unmapped: summary.unmapped,
        files: {
          leveredge: leveredge.length,
          xero: xero.length,
          physical: physical.length,
          manualCounts: parsedCounts.counts.rows.length,
        },
      }),
    }
    await storage.logAudit(audit)
    return removed
  })

  res.status(200).json({
    date,
    location,
    replacedRows,
    parsed: {
      leveredge: leveredge.length,
      xero: xero.length,
      physical: physical.length,
      manualCounts: parsedCounts.counts.rows.length,
    },
    summary: {
      rowCount: summary.rowCount,
      matched: summary.matched,
      discrepancy: summary.discrepancy,
      unmapped: summary.unmapped,
      needsReview: summary.needsReview,
      atRiskSkus: summary.needsReview,
      dockedQty: summary.dockedQty,
      dockedValueNGN: summary.totalDockedValueNGN,
      undockedQty: summary.undockedQty,
      undockedValueNGN: summary.totalUndockedValueNGN,
      totalVarianceValueNGN: summary.totalVarianceValueNGN,
    },
  })
}

reconciliationRouter.post(
  '/submit',
  requireAuth,
  requireRole('warehouse_manager', 'admin'),
  uploadFields,
  handleSubmit
)

async function handleStatus(req: Request, res: Response): Promise<void> {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : ''
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || location === '') {
    res.status(400).json({ error: 'DATE_AND_LOCATION_REQUIRED' })
    return
  }
  await storageReady()
  const rows = await getStorage().readTable(RECONCILIATION_SHEET)
  const scoped = rows
    .filter(
      (row) =>
        String(row.Date) === date && String(row.Location).toLowerCase() === location.toLowerCase()
    )
    .map(tableRowToReconRow)
  res.json({
    date,
    location,
    locked: !isSubmissionOpen(date),
    rowCount: scoped.length,
    summary: summarizeRows(scoped),
    rows: scoped,
  })
}

reconciliationRouter.get('/status', requireAuth, requireLocation, handleStatus)
