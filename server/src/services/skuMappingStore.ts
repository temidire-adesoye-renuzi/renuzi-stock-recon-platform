import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  DEFAULT_CS_FACTOR,
  DEFAULT_DZ_FACTOR,
  SKU_MAPPING_CSV_COLUMNS,
  type SkuMappingEntry,
} from './schema.js'
import { SKU_SEED_PATH } from '../config.js'

/**
 * SKU mapping seed store (samples/sku_seed.csv). Phase 2 persists admin edits
 * back to the CSV on disk; Phase 3 migrates this to the SKUMapping sheet in
 * the Master Excel workbook.
 */

export type SkuMappingOpResult =
  | { ok: true; entry: SkuMappingEntry }
  | { ok: false; error: 'SKU_MAPPING_EXISTS' | 'SKU_MAPPING_NOT_FOUND' | 'INVALID_SKU_MAPPING' }

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Minimal RFC-4180 CSV serializer (LF line endings). */
export function stringifyCsv(rows: string[][]): string {
  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return rows.map((row) => row.map(escape).join(',')).join('\n') + '\n'
}

function cellToNumber(value: string | undefined, fallback: number): number {
  const parsed = Number((value ?? '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function rowToEntry(cells: string[], columnIndex: Record<string, number>): SkuMappingEntry {
  const at = (column: string) => cells[columnIndex[column]]?.trim() ?? ''
  return {
    leverEdgeSkuCode: at('LeverEdge_SKU_Code'),
    leverEdgeItemName: at('LeverEdge_Item_Name'),
    xeroItemCode: at('Xero_Item_Code'),
    xeroItemName: at('Xero_Item_Name'),
    csFactor: cellToNumber(at('CS_Factor'), DEFAULT_CS_FACTOR),
    dzFactor: cellToNumber(at('DZ_Factor'), DEFAULT_DZ_FACTOR),
    category: at('Category'),
    active: !['false', '0', 'no'].includes(at('Active').toLowerCase()),
  }
}

function entryToRow(entry: SkuMappingEntry): string[] {
  return [
    entry.leverEdgeSkuCode,
    entry.leverEdgeItemName,
    entry.xeroItemCode,
    entry.xeroItemName,
    String(entry.csFactor),
    String(entry.dzFactor),
    entry.category,
    entry.active ? 'true' : 'false',
  ]
}

export function loadSkuMapping(path: string = SKU_SEED_PATH): SkuMappingEntry[] {
  if (!existsSync(path)) return []
  const rows = parseCsv(readFileSync(path, 'utf-8')).filter((row) =>
    row.some((cell) => cell.trim() !== '')
  )
  if (rows.length === 0) return []
  const columnIndex: Record<string, number> = {}
  rows[0].forEach((header, index) => {
    const name = header.trim()
    if (name !== '' && columnIndex[name] === undefined) columnIndex[name] = index
  })
  const entries: SkuMappingEntry[] = []
  for (const cells of rows.slice(1)) {
    const entry = rowToEntry(cells, columnIndex)
    if (entry.leverEdgeSkuCode !== '') entries.push(entry)
  }
  return entries
}

export function saveSkuMapping(entries: SkuMappingEntry[], path: string = SKU_SEED_PATH): void {
  mkdirSync(dirname(path), { recursive: true })
  const rows = [[...SKU_MAPPING_CSV_COLUMNS], ...entries.map(entryToRow)]
  writeFileSync(path, stringifyCsv(rows), 'utf-8')
}

/** Coerce arbitrary JSON input into a SkuMappingEntry (shared validation). */
export function coerceSkuMappingInput(
  input: unknown
): { ok: true; entry: SkuMappingEntry } | { ok: false } {
  if (typeof input !== 'object' || input === null) return { ok: false }
  const body = input as Record<string, unknown>
  const asText = (value: unknown): string =>
    typeof value === 'string'
      ? value.trim()
      : value === null || value === undefined
        ? ''
        : String(value).trim()
  const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.trim())
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }
  const asBoolean = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string' && value.trim() !== '')
      return value.trim().toLowerCase() === 'true'
    return null
  }

  const leverEdgeSkuCode = asText(body.leverEdgeSkuCode)
  if (leverEdgeSkuCode === '') return { ok: false }
  const csFactor = asNumber(body.csFactor)
  const dzFactor = asNumber(body.dzFactor)
  const active = asBoolean(body.active)

  return {
    ok: true,
    entry: {
      leverEdgeSkuCode,
      leverEdgeItemName: asText(body.leverEdgeItemName),
      xeroItemCode: asText(body.xeroItemCode),
      xeroItemName: asText(body.xeroItemName),
      csFactor: csFactor !== null && csFactor > 0 ? csFactor : DEFAULT_CS_FACTOR,
      dzFactor: dzFactor !== null && dzFactor > 0 ? dzFactor : DEFAULT_DZ_FACTOR,
      category: asText(body.category),
      active: active ?? true,
    },
  }
}

export function listSkuMappings(path: string = SKU_SEED_PATH): SkuMappingEntry[] {
  return loadSkuMapping(path)
}

export function createSkuMapping(input: unknown, path: string = SKU_SEED_PATH): SkuMappingOpResult {
  const coerced = coerceSkuMappingInput(input)
  if (!coerced.ok) return { ok: false, error: 'INVALID_SKU_MAPPING' }
  const entries = loadSkuMapping(path)
  if (entries.some((entry) => entry.leverEdgeSkuCode === coerced.entry.leverEdgeSkuCode)) {
    return { ok: false, error: 'SKU_MAPPING_EXISTS' }
  }
  entries.push(coerced.entry)
  saveSkuMapping(entries, path)
  return { ok: true, entry: coerced.entry }
}

export function updateSkuMapping(
  code: string,
  input: unknown,
  path: string = SKU_SEED_PATH
): SkuMappingOpResult {
  const entries = loadSkuMapping(path)
  const index = entries.findIndex((entry) => entry.leverEdgeSkuCode === code.trim())
  if (index < 0) return { ok: false, error: 'SKU_MAPPING_NOT_FOUND' }
  const coerced = coerceSkuMappingInput({ ...entries[index], ...(input as object) })
  if (!coerced.ok) return { ok: false, error: 'INVALID_SKU_MAPPING' }
  if (
    entries.some(
      (entry, i) => i !== index && entry.leverEdgeSkuCode === coerced.entry.leverEdgeSkuCode
    )
  ) {
    return { ok: false, error: 'SKU_MAPPING_EXISTS' }
  }
  entries[index] = coerced.entry
  saveSkuMapping(entries, path)
  return { ok: true, entry: coerced.entry }
}

export function deleteSkuMapping(code: string, path: string = SKU_SEED_PATH): SkuMappingOpResult {
  const entries = loadSkuMapping(path)
  const index = entries.findIndex((entry) => entry.leverEdgeSkuCode === code.trim())
  if (index < 0) return { ok: false, error: 'SKU_MAPPING_NOT_FOUND' }
  const [entry] = entries.splice(index, 1)
  saveSkuMapping(entries, path)
  return { ok: true, entry }
}
