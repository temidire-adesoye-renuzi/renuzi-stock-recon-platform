import * as XLSX from 'xlsx'

/**
 * Shared XLSX (SheetJS) helpers for the daily export parsers. All three
 * exports have title blocks above the real header row, "Total"/"Grand Total"
 * footer rows, dash "-" placeholder cells, and SKU codes that must survive as
 * trimmed strings (13-digit barcodes like 7791293049250).
 */

export interface HeaderFieldSpec {
  /** Logical field key used by the parser (e.g. "sku", "qty"). */
  key: string
  /** Accepted header cell names (case/punctuation/spacing-insensitive). */
  names: string[]
}

export interface HeaderMatch {
  /** 0-based index of the detected header row. */
  index: number
  /** field key -> column index within the row. */
  columns: Record<string, number>
}

/** Normalize a header cell for matching: uppercase, punctuation -> single spaces. */
export function normalizeHeaderName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/**
 * Scan rows for the header row: the first row containing every required field
 * name (case-insensitive, punctuation/spacing-insensitive). Title blocks,
 * dates and page furniture above the header never contain all field names.
 */
export function findHeaderRow(rows: unknown[][], fields: HeaderFieldSpec[]): HeaderMatch | null {
  for (let index = 0; index < rows.length; index++) {
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

/** A footer row: first non-blank cell starts with "Total" / "Grand Total" / "TOTAL CASES". */
export function isTotalRow(row: unknown[]): boolean {
  for (const cell of row) {
    if (isBlank(cell)) continue
    return typeof cell === 'string' && /^(grand\s+)?total\b/i.test(cell.trim())
  }
  return false
}

/** Drop empty rows and Total/Grand Total footer rows below the header. */
export function cleanRows(rows: unknown[][], startIndex: number): unknown[][] {
  const cleaned: unknown[][] = []
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((cell) => isBlank(cell))) continue
    if (isTotalRow(row)) continue
    cleaned.push(row)
  }
  return cleaned
}

/**
 * Coerce a cell to a trimmed string. Numeric SKUs become exact strings
 * (7791293049250 survives intact), dashes become null.
 */
export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' || trimmed === '-' ? null : trimmed
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (value instanceof Date) return value.toISOString()
  return null
}

/** Coerce a cell to a number. Dashes, blanks and stray text become null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === '-') return null
    const parsed = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Read every sheet of a workbook as a raw 2-D array (nulls for empty cells). */
export function readWorkbookRows(buffer: Buffer): Map<string, unknown[][]> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheets = new Map<string, unknown[][]>()
  for (const name of workbook.SheetNames) {
    sheets.set(
      name,
      XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: null,
        blankrows: true,
      })
    )
  }
  return sheets
}
