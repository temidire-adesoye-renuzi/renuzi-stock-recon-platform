import type { AuditLogEntry, WorkbookCellValue, WorkbookTableRow } from '../schema.js'
import { WriteQueue, withRetry } from './writeQueue.js'
import type { IStorage } from './types.js'

/**
 * QueuedStorage: serializes every storage mutation through one WriteQueue and
 * adds 429/503 backoff retries. Reads stay concurrent — each mutation itself
 * is atomic (load-modify-write inside one queued operation).
 */
export class QueuedStorage implements IStorage {
  private readonly queue = new WriteQueue()

  constructor(private readonly inner: IStorage) {}

  get mode(): 'mock' | 'live' {
    return this.inner.mode
  }

  ensureWorkbook(): Promise<void> {
    return this.run(() => this.inner.ensureWorkbook())
  }

  appendRows(sheet: string, rows: WorkbookCellValue[][]): Promise<void> {
    return this.run(() => this.inner.appendRows(sheet, rows))
  }

  readTable(sheet: string): Promise<WorkbookTableRow[]> {
    return this.inner.readTable(sheet)
  }

  deleteRows(sheet: string, filter: (row: WorkbookTableRow) => boolean): Promise<number> {
    return this.run(() => this.inner.deleteRows(sheet, filter))
  }

  updateCell(
    sheet: string,
    rowNum: number,
    column: string,
    value: WorkbookCellValue
  ): Promise<void> {
    return this.run(() => this.inner.updateCell(sheet, rowNum, column, value))
  }

  logAudit(entry: AuditLogEntry): Promise<void> {
    return this.run(() => this.inner.logAudit(entry))
  }

  /**
   * Run a multi-step storage transaction (e.g. delete + append + audit) as a
   * single step in the global write queue. Nested writes made through THIS
   * wrapper inside the transaction execute inline (re-entrant) instead of
   * deadlocking behind the transaction itself.
   */
  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.queue.runExclusive(operation)
  }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    return this.queue.enqueue(() => withRetry(operation))
  }
}
