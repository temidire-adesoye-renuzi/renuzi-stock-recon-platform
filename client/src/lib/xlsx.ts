/**
 * Client-side export parsers + Zod header validation — mirrors
 * server/src/services/parsers/* and server/src/services/xlsxHelpers.ts.
 *
 * The real backend has no /reconciliation/preview endpoint, so previews parse
 * the dropped files IN THE BROWSER (SheetJS) with the same header-scanning and
 * quirks handling the server uses; submit remains the authoritative parse.
 */
import * as XLSX from 'xlsx'
import { z } from 'zod'

export interface LeverEdgeItemRow {
  sku: string
  name: string
  qty: number | null
  unitPrice: number | null
}

export interface XeroItemRow extends LeverEdgeItemRow {
  location: string
  sheetDate: string | null
}

export interface PhysicalItemRow {
  sku: string
  name: string
  cs: number | null
  dz: number | null
  pc: number | null
  unitPrice: number | null
  location: string | null
}

/** Thrown before a file is accepted; `issues` are human, column-level messages. */
export class FileValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues[0] ?? 'File could not be validated')
    this.name = 'FileValidationError'
    this.issues = issues
  }
}

type Cell = string | number | boolean | Date | null

/** Normalize a header cell for matching (mirrors xlsxHelpers.normalizeHeaderName). */
function normalizeHeaderName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

interface FieldSpec {
  key: string
  names: string[]
  label: string
}

interface HeaderMatch {
  index: number
  columns: Record<string, number>
}

function findHeaderRow(rows: Cell[][], fields: FieldSpec[]): HeaderMatch | null {
  for (let index = 0; index < rows.length; index += 1) {
    const positions = new Map<string, number>()
    rows[index].forEach((cell, col) => {
      const normalized = normalizeHeaderName(cell)
      if (normalized !== '' && !positions.has(normalized)) positions.set(normalized, col)
    })
    const columns: Record<string, number> = {}
    let complete = true
    for (const field of fields) {
      const name = field.names
        .map(normalizeHeaderName)
        .find((candidate) => positions.has(candidate))
      if (name === undefined) {
        complete = false
        break
      }
      columns[field.key] = positions.get(name)!
    }
    if (complete) return { index, columns }
  }
  return null
}

function isBlank(cell: unknown): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')
}

function isTotalRow(row: Cell[]): boolean {
  for (const cell of row) {
    if (isBlank(cell)) continue
    return typeof cell === 'string' && /^(grand\s+)?total\b/i.test(cell.trim())
  }
  return false
}

function cleanRows(rows: Cell[][], startIndex: number): Cell[][] {
  const cleaned: Cell[][] = []
  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i]
    if (row.every((cell) => isBlank(cell))) continue
    if (isTotalRow(row)) continue
    cleaned.push(row)
  }
  return cleaned
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' || trimmed === '-' ? null : trimmed
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (value instanceof Date) return value.toISOString()
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === '-') return null
    const parsed = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function readWorkbookRows(file: File): Promise<Map<string, Cell[][]>> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheets = new Map<string, Cell[][]>()
  for (const name of workbook.SheetNames) {
    sheets.set(
      name,
      XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: null,
        blankrows: true,
      }) as Cell[][]
    )
  }
  return sheets
}

const MAX_ROW_ISSUES = 5

/**
 * Zod-powered header check: `found` maps the normalized column names present on
 * the detected header row; required-but-absent columns surface as one issue per
 * column with the human display name.
 */
function validateHeader(
  fileLabel: string,
  fields: FieldSpec[],
  found: string[],
): string[] {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    for (const name of field.names) shape[normalizeHeaderName(name)] = z.string()
  }
  const schema = z.object(shape).strict()
  const headerRecord = Object.fromEntries(found.map((name) => [name, name]))
  const result = schema.safeParse(headerRecord)
  if (result.success) return []
  const missing = new Set<string>()
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '')
    const field = fields.find((candidate) =>
      candidate.names.some((name) => normalizeHeaderName(name) === key),
    )
    if (field) missing.add(field.label)
  }
  return [...missing].map(
    (label) => `${fileLabel}: missing required column "${label}".`,
  )
}

function validateRows<T>(
  fileLabel: string,
  schema: z.ZodType<T>,
function validateRows<T>(
  fileLabel: string,
  schema: z.ZodType<T>,
  rows: T[],
): { ok: boolean; issues: string[] } {
): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const result = schema.safeParse(rows[i])
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'row'} ${issue.message}`)
        .join('; ')
      if (issues.length < MAX_ROW_ISSUES) {
        issues.push(`${fileLabel}: data row ${i + 1} — ${detail}.`)
      }
    }
  }
  return { ok: issues.length === 0, issues }
}

// --- LeverEdge -------------------------------------------------------------

const LEVEREDGE_FIELDS: FieldSpec[] = [
  { key: 'sku', names: ['Item Code'], label: 'Item Code' },
  { key: 'name', names: ['Item Name'], label: 'Item Name' },
  { key: 'unitPrice', names: ['Unit Sale Price'], label: 'Unit Sale Price' },
  { key: 'qty', names: ['Quantity On Hand'], label: 'Quantity On Hand' },
]

const leverEdgeRowSchema = z.object({
  sku: z.string().min(1, 'must not be empty'),
  name: z.string(),
  qty: z.number().nullable(),
  unitPrice: z.number().nullable(),
})

export interface ParsedFile<T> {
  rows: T[]
  sheetName: string
  headerRowIndex: number
}

export async function parseLeverEdgeFile(file: File): Promise<ParsedFile<LeverEdgeItemRow>> {
  const sheets = await readWorkbookRows(file)
  const sheetName = [...sheets.keys()][0]
  const rows = sheets.get(sheetName ?? '') ?? []
  if (!sheetName || rows.length === 0) {
    throw new FileValidationError(['LeverEdge export: workbook has no sheets.'])
  }
  const header = findHeaderRow(rows, LEVEREDGE_FIELDS)
  if (!header) {
    const present = new Set<string>()
    for (const row of rows.slice(0, 30)) {
      for (const cell of row) {
        const normalized = normalizeHeaderName(cell)
        if (normalized !== '') present.add(normalized)
      }
    }
    throw new FileValidationError([
      ...validateHeader('LeverEdge export', LEVEREDGE_FIELDS, [...present]),
      'LeverEdge export: header row not found — expected Item Code / Item Name / Unit Sale Price / Quantity On Hand.',
    ])
  }
  const items: LeverEdgeItemRow[] = []
  for (const row of cleanRows(rows, header.index + 1)) {
    const sku = toText(row[header.columns.sku])
    if (sku === null) continue
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? '',
      qty: toNumber(row[header.columns.qty]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice]),
    })
  }
  const check = validateRows('LeverEdge export', leverEdgeRowSchema, items)
  if (!check.ok) throw new FileValidationError(check.issues)
  return { rows: items, sheetName, headerRowIndex: header.index }
}

// --- Xero ------------------------------------------------------------------

const XERO_FIELDS: FieldSpec[] = [
  { key: 'sku', names: ['Item Code'], label: 'Item Code' },
  { key: 'name', names: ['Item Name'], label: 'Item Name' },
  { key: 'unitPrice', names: ['Unit Sale Price'], label: 'Unit Sale Price' },
  // Header case varies per sheet (XERO / xero).
  { key: 'qty', names: ['XERO'], label: 'XERO (tracked quantity)' },
]

const xeroRowSchema = leverEdgeRowSchema.extend({
  location: z.string(),
  sheetDate: z.string().nullable(),
})

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "KETU 18-SEP-26   " -> "Ketu" (sheet names carry trailing spaces). */
export function locationFromSheetName(sheetName: string): string {
  const word = sheetName.trim().split(/\s+/)[0] ?? ''
  if (word === '') return 'Unknown'
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Extract YYYY-MM-DD from a sheet name like "KETU 18-SEP-26". */
export function dateFromSheetName(sheetName: string): string | null {
  const match = sheetName.trim().match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\b/)
  if (!match) return null
  const day = Number(match[1])
  const month = MONTHS.indexOf(match[2].toUpperCase())
  let year = Number(match[3])
  if (year < 100) year += 2000
  if (month < 0 || day < 1 || day > 31) return null
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function parseXeroFile(
  file: File,
): Promise<ParsedFile<XeroItemRow> & { sheetNames: string[] }> {
): Promise<ParsedFile<XeroItemRow> & { sheetNames: string[] }> {
  const sheets = await readWorkbookRows(file)
  if (sheets.size === 0) {
    throw new FileValidationError(['Xero export: workbook has no sheets.'])
  }
  const items: XeroItemRow[] = []
  const sheetNames: string[] = []
  for (const [sheetName, rows] of sheets) {
    const header = findHeaderRow(rows, XERO_FIELDS)
    if (!header) {
      throw new FileValidationError([
        `Xero export sheet "${sheetName.trim()}": header row not found — expected Item Code / Item Name / Unit Sale Price / XERO.`,
      ])
    }
    sheetNames.push(sheetName.trim())
    const location = locationFromSheetName(sheetName)
    const sheetDate = dateFromSheetName(sheetName)
    for (const row of cleanRows(rows, header.index + 1)) {
      const sku = toText(row[header.columns.sku])
      if (sku === null) continue
      items.push({
        sku,
        name: toText(row[header.columns.name]) ?? '',
        qty: toNumber(row[header.columns.qty]) ?? 0,
        unitPrice: toNumber(row[header.columns.unitPrice]),
        location,
        sheetDate,
      })
    }
  }
  const check = validateRows('Xero export', xeroRowSchema, items)
  if (!check.ok) throw new FileValidationError(check.issues)
  return {
    rows: items,
    sheetName: sheetNames.join(', '),
    headerRowIndex: 0,
    sheetNames,
  }
}

// --- Physical --------------------------------------------------------------

const PHYSICAL_FIELDS: FieldSpec[] = [
  { key: 'sku', names: ['SKU Code'], label: 'SKU Code' },
  { key: 'name', names: ['SKU Description'], label: 'SKU Description' },
  { key: 'cs', names: ['CS'], label: 'CS' },
  { key: 'dz', names: ['DZ'], label: 'DZ' },
  { key: 'pc', names: ['PC'], label: 'PC' },
  { key: 'unitPrice', names: ['List Price'], label: 'List Price' },
]

const physicalRowSchema = z.object({
  sku: z.string().min(1, 'must not be empty'),
  name: z.string(),
  cs: z.number().nullable(),
  dz: z.number().nullable(),
  pc: z.number().nullable(),
  unitPrice: z.number().nullable(),
})

function locationFromTitleBlock(rows: Cell[][], headerIndex: number): string | null {
  for (let r = 0; r < headerIndex; r += 1) {
    const row = rows[r]
    for (let c = 0; c < row.length; c += 1) {
      if (normalizeHeaderName(row[c]) !== 'LOCATION') continue
      for (let k = c + 1; k < row.length; k += 1) {
        const value = toText(row[k])
        if (value !== null) return value
      }
    }
  }
  return null
}

export async function parsePhysicalFile(file: File): Promise<ParsedFile<PhysicalItemRow>> {
  const sheets = await readWorkbookRows(file)
  const sheetName = [...sheets.keys()][0]
  const rows = sheets.get(sheetName ?? '') ?? []
  if (!sheetName || rows.length === 0) {
    throw new FileValidationError(['Physical stock report: workbook has no sheets.'])
  }
  const header = findHeaderRow(rows, PHYSICAL_FIELDS)
  if (!header) {
    const present = new Set<string>()
    for (const row of rows.slice(0, 30)) {
      for (const cell of row) {
        const normalized = normalizeHeaderName(cell)
        if (normalized !== '') present.add(normalized)
      }
    }
    throw new FileValidationError([
      ...validateHeader('Physical stock report', PHYSICAL_FIELDS, [...present]),
      'Physical stock report: header row not found — expected SKU Code / SKU Description / CS / DZ / PC / List Price.',
    ])
  }
  const location = locationFromTitleBlock(rows, header.index)
  const items: PhysicalItemRow[] = []
  for (const row of cleanRows(rows, header.index + 1)) {
    const sku = toText(row[header.columns.sku])
    if (sku === null) continue
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? '',
      cs: toNumber(row[header.columns.cs]) ?? 0,
      dz: toNumber(row[header.columns.dz]) ?? 0,
      pc: toNumber(row[header.columns.pc]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice]),
      location,
    })
  }
  const check = validateRows('Physical stock report', physicalRowSchema, items)
  if (!check.ok) throw new FileValidationError(check.issues)
  return { rows: items, sheetName, headerRowIndex: header.index }
}
