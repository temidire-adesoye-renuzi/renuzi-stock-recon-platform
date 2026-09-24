import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ExcelJS, { type TableProperties, type Worksheet } from 'exceljs'
import {
  AUDITLOG_SHEET,
  WORKBOOK_SHEETS,
  auditEntryToCells,
  sheetSpec,
  type AuditLogEntry,
  type WorkbookCellValue,
  type WorkbookSheetSpec,
  type WorkbookTableRow,
} from '../schema.js'
import type { IStorage } from './types.js'

/**
 * Mock storage: the master workbook as a local .xlsx file, built with ExcelJS
 * so the sheets contain REAL Excel tables (Power BI can read them directly).
 *
 * Every mutation loads the file, rebuilds the affected sheet and writes the
 * file atomically (temp file + rename). The QueuedStorage decorator in the
 * factory guarantees mutations never interleave.
 */

/**
 * Table names of a worksheet. ExcelJS typings say getTables() returns
 * [Table, void][] tuples but the runtime returns Table[] — handle both.
 */
function tableNames(ws: Worksheet): string[] {
  return ws
    .getTables()
    .map((entry) => {
      const value = Array.isArray(entry) ? entry[0] : (entry as unknown)
      return (value as { name?: string } | undefined)?.name
    })
    .filter((name): name is string => typeof name === 'string')
}

const TABLE_STYLE: TableProperties['style'] = {
  theme: 'TableStyleMedium2',
  showRowStripes: true,
}

function cellFromSheet(value: unknown): WorkbookCellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'result' in value) {
    // Formula cell: keep the cached result.
    return cellFromSheet((value as { result?: unknown }).result)
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText?: Array<{ text?: string }> }).richText
    return parts?.map((part) => part.text ?? '').join('') ?? null
  }
  return String(value)
}

function dataRowCount(ws: Worksheet): number {
  const values = ws.getSheetValues() // 1-based: index 1 = header row
  let count = 0
  for (let i = 2; i < values.length; i++) {
    const row = values[i]
    if (row === undefined || row === null) break
    const cells = Array.isArray(row) ? row : Object.values(row)
    const empty = cells.every((cell) => cellFromSheet(cell) === null)
    if (empty) break
    count += 1
  }
  return count
}

/** Header row of a worksheet as trimmed names (index 0 = column 1). */
function headerNames(ws: Worksheet): string[] {
  const values = ws.getSheetValues()
  const headerRow = values?.[1]
  if (!headerRow) return []
  const cells = Array.isArray(headerRow) ? headerRow : Object.values(headerRow)
  const names: string[] = []
  for (let c = 1; c < cells.length; c++) {
    const cell = cellFromSheet(cells[c])
    names.push(cell === null ? '' : String(cell).trim())
  }
  return names
}

/** True when the sheet's header row matches the spec column-for-column. */
function headersMatchSpec(ws: Worksheet, spec: WorkbookSheetSpec): boolean {
  const names = headerNames(ws)
  return spec.columns.every((column, index) => names[index] === column)
}

/**
 * Data rows keyed by the sheet's OWN header names (the header row as written,
 * not the current spec). The migration source of truth: values survive by
 * column NAME even when the sheet predates a schema extension.
 */
function readRowsByOwnHeaders(ws: Worksheet): WorkbookTableRow[] {
  const headers = headerNames(ws)
  const width = headers.length
  if (width === 0) return []
  const values = ws.getSheetValues()
  const rows: WorkbookTableRow[] = []
  for (let i = 2; i < values.length; i++) {
    const raw = values[i]
    if (raw === undefined) break
    const record: WorkbookTableRow = {}
    let empty = true
    for (let c = 1; c <= width; c++) {
      const value = cellFromSheet((raw as Record<number, unknown>)[c])
      if (value !== null) empty = false
      const name = headers[c - 1]
      if (name !== '') record[name] = value
    }
    if (empty) break
    rows.push(record)
  }
  return rows
}

export class MockStorage implements IStorage {
  readonly mode = 'mock' as const
  private ensured = false

  constructor(private readonly filePath: string) {}

  private async loadWorkbook(): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook()
    if (existsSync(this.filePath)) {
      await wb.xlsx.readFile(this.filePath)
    }
    return wb
  }

  private async saveWorkbook(wb: ExcelJS.Workbook): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const buffer = await wb.xlsx.writeBuffer()
    const tempPath = join(dirname(this.filePath), `.${Math.random().toString(36).slice(2)}.tmp`)
    try {
      writeFileSync(tempPath, Buffer.from(buffer))
      renameSync(tempPath, this.filePath)
    } finally {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    }
  }

  /** Data rows of a sheet as column-ordered cell arrays. */
  private readCells(ws: Worksheet, spec: WorkbookSheetSpec): WorkbookCellValue[][] {
    const values = ws.getSheetValues()
    const rows: WorkbookCellValue[][] = []
    const width = spec.columns.length
    for (let i = 2; i < values.length; i++) {
      const raw = values[i]
      if (raw === undefined) break
      const cells: WorkbookCellValue[] = []
      for (let c = 1; c <= width; c++) {
        cells.push(cellFromSheet((raw as Record<number, unknown>)[c]))
      }
      if (cells.every((cell) => cell === null)) break
      rows.push(cells)
    }
    return rows
  }

  private sheetRowsAsRecords(ws: Worksheet, spec: WorkbookSheetSpec): WorkbookTableRow[] {
    return this.readCells(ws, spec).map((cells) => {
      const record: WorkbookTableRow = {}
      spec.columns.forEach((column, index) => {
        record[column] = cells[index]
      })
      return record
    })
  }

  /**
   * Rebuild a sheet: replace the worksheet entirely, then add one table
   * covering the header + all data rows.
   *
   * Replacement (not splice) is deliberate: ExcelJS spliceRows is a no-op
   * when clearing a worksheet's full row range, and table-materialised cells
   * otherwise survive saves as stale tail rows. Removing and re-adding the
   * worksheet is deterministic; the tab position (orderNo) is preserved.
   */
  private rebuildSheet(wb: ExcelJS.Workbook, spec: WorkbookSheetSpec, rows: WorkbookCellValue[][]): void {
    const previous = wb.getWorksheet(spec.sheet)
    // orderNo exists at runtime but is missing from ExcelJS's typings.
    const orderNo = (previous as unknown as { orderNo?: number } | undefined)?.orderNo
    if (previous) wb.removeWorksheet(spec.sheet)
    const ws = wb.addWorksheet(spec.sheet)
    if (typeof orderNo === 'number') (ws as unknown as { orderNo: number }).orderNo = orderNo
    ws.addTable({
      name: spec.table,
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: TABLE_STYLE,
      columns: spec.columns.map((name) => ({ name, filterButton: true })),
      rows,
    })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    spec.columns.forEach((name, index) => {
      ws.getColumn(index + 1).width = Math.min(Math.max(name.length + 4, 14), 26)
    })
  }

  async ensureWorkbook(): Promise<void> {
    const wb = await this.loadWorkbook()
    let changed = !existsSync(this.filePath)
    for (const spec of WORKBOOK_SHEETS) {
      const ws = wb.getWorksheet(spec.sheet)
      if (!ws || !tableNames(ws).includes(spec.table)) {
        // Preserve any existing data (e.g. sheet created outside a table).
        const existingRows = ws ? this.readCells(ws, spec) : []
        this.rebuildSheet(wb, spec, existingRows)
        changed = true
      } else if (!headersMatchSpec(ws, spec)) {
        // Schema migration: the table predates a column extension. Rebuild
        // the sheet from its own records under the new spec — every value
        // keeps its column, fields the old sheet never had become null.
        const existingRows = readRowsByOwnHeaders(ws).map((record) =>
          spec.columns.map((column) => record[column] ?? null)
        )
        this.rebuildSheet(wb, spec, existingRows)
        changed = true
      }
    }
    if (changed) await this.saveWorkbook(wb)
    this.ensured = true
  }

  async appendRows(sheet: string, rows: WorkbookCellValue[][]): Promise<void> {
    if (!this.ensured) await this.ensureWorkbook()
    const spec = sheetSpec(sheet)
    if (rows.length === 0) return
    const wb = await this.loadWorkbook()
    const ws = wb.getWorksheet(spec.sheet)
    if (!ws) throw new Error(`MockStorage: sheet "${sheet}" is missing — call ensureWorkbook() first`)
    const all = [...this.readCells(ws, spec), ...rows]
    this.rebuildSheet(wb, spec, all)
    await this.saveWorkbook(wb)
  }

  async readTable(sheet: string): Promise<WorkbookTableRow[]> {
    if (!existsSync(this.filePath)) return []
    const spec = sheetSpec(sheet)
    const wb = await this.loadWorkbook()
    const ws = wb.getWorksheet(spec.sheet)
    if (!ws) return []
    return this.sheetRowsAsRecords(ws, spec)
  }

  async deleteRows(
    sheet: string,
    filter: (row: WorkbookTableRow) => boolean
  ): Promise<number> {
    if (!this.ensured) await this.ensureWorkbook()
    const spec = sheetSpec(sheet)
    const wb = await this.loadWorkbook()
    const ws = wb.getWorksheet(spec.sheet)
    if (!ws) return 0
    const rows = this.sheetRowsAsRecords(ws, spec)
    const kept: WorkbookTableRow[] = []
    let removed = 0
    for (const row of rows) {
      if (filter(row)) removed += 1
      else kept.push(row)
    }
    if (removed > 0) {
      this.rebuildSheet(
        wb,
        spec,
        kept.map((row) => spec.columns.map((column) => row[column] ?? null))
      )
      await this.saveWorkbook(wb)
    }
    return removed
  }

  async updateCell(
    sheet: string,
    rowNum: number,
    column: string,
    value: WorkbookCellValue
  ): Promise<void> {
    if (!this.ensured) await this.ensureWorkbook()
    const spec = sheetSpec(sheet)
    const colIndex = spec.columns.indexOf(column)
    if (colIndex < 0) throw new Error(`MockStorage: unknown column "${column}" on sheet "${sheet}"`)
    if (!Number.isInteger(rowNum) || rowNum < 1) {
      throw new Error(`MockStorage: rowNum must be a 1-based integer >= 1`)
    }
    const wb = await this.loadWorkbook()
    const ws = wb.getWorksheet(spec.sheet)
    if (!ws) throw new Error(`MockStorage: sheet "${sheet}" is missing`)
    const available = dataRowCount(ws)
    if (rowNum > available) {
      throw new Error(
        `MockStorage: rowNum ${rowNum} is beyond the last data row (${available}) of "${sheet}"`
      )
    }
    ws.getRow(rowNum + 1).getCell(colIndex + 1).value = value
    await this.saveWorkbook(wb)
  }

  async logAudit(entry: AuditLogEntry): Promise<void> {
    await this.appendRows(AUDITLOG_SHEET, [auditEntryToCells(entry)])
  }
}
