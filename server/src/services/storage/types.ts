import type {
  AuditLogEntry,
  WorkbookCellValue,
  WorkbookTableRow,
} from '../schema.js'

/**
 * Storage abstraction over the master Excel workbook.
 *
 * Two implementations exist:
 *  - mock: local .xlsx file via ExcelJS (default; GRAPH_MODE=mock)
 *  - live: OneDrive workbook via Microsoft Graph (GRAPH_MODE=live)
 *
 * Everything else in the app depends ONLY on this interface, so switching
 * between them is a pure env-var change.
 */
export interface IStorage {
  /** 'mock' (local file) or 'live' (Microsoft Graph). */
  readonly mode: 'mock' | 'live'

  /**
   * Create the workbook (if missing) and make sure every expected sheet and
   * real Excel table exists. Idempotent.
   */
  ensureWorkbook(): Promise<void>

  /**
   * Append rows to a sheet's table. Each row is a column-ordered array of
   * cells matching the sheet spec in schema.ts.
   */
  appendRows(sheet: string, rows: WorkbookCellValue[][]): Promise<void>

  /**
   * Read a sheet's table as row records keyed by column name. Empty sheet
   * resolves to [].
   */
  readTable(sheet: string): Promise<WorkbookTableRow[]>

  /**
   * Remove every row matching the filter; returns the number of rows removed.
   */
  deleteRows(sheet: string, filter: (row: WorkbookTableRow) => boolean): Promise<number>

  /**
   * Update one cell. `rowNum` is 1-based within the table's data area
   * (1 = first row under the header); `column` is a column name.
   */
  updateCell(
    sheet: string,
    rowNum: number,
    column: string,
    value: WorkbookCellValue
  ): Promise<void>

  /** Append one entry to the AuditLog sheet. */
  logAudit(entry: AuditLogEntry): Promise<void>
}
