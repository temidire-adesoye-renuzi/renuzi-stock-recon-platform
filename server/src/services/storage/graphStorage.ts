import { ConfidentialClientApplication } from '@azure/msal-node'
import {
  AuthenticationHandler,
  Client,
  HTTPMessageHandler,
} from '@microsoft/microsoft-graph-client'
import {
  WORKBOOK_SHEETS,
  auditEntryToCells,
  sheetSpec,
  type AuditLogEntry,
  type WorkbookCellValue,
  type WorkbookSheetSpec,
  type WorkbookTableRow,
} from '../schema.js'
import { withRetry } from './writeQueue.js'
import type { IStorage } from './types.js'

/**
 * Live storage: the master workbook on OneDrive, driven through the
 * Microsoft Graph workbook API (Excel endpoints).
 *
 *  - Client-credentials auth via @azure/msal-node (app-only token).
 *  - Workbook session with persistChanges=true, recreated automatically when
 *    Graph reports it expired.
 *  - Every request retries with exponential backoff on HTTP 429/503.
 *
 * NOTE: this implementation cannot be exercised until Azure credentials are
 * provisioned (see scripts/graph-check.ts — the Day-1 go-live tool).
 */

export interface GraphStorageConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  driveId: string
  fileItemId: string
}

/** 1 -> A, 27 -> AA ... */
export function columnLetter(index: number): string {
  let n = index
  let letters = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters || 'A'
}

function cellOut(value: WorkbookCellValue): WorkbookCellValue {
  return value
}

function toCellValue(value: unknown): WorkbookCellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

/** Column-name key for readTable records (always a string). */
function cellKey(value: unknown): string {
  const cell = toCellValue(value)
  return cell === null ? '' : String(cell)
}

interface SessionResponse {
  id: string
}

interface RangeResponse {
  values: unknown[][]
}

interface TableRowEntity {
  index: number
  values: unknown[]
}

/** Graph Range resource (subset) — response of the table `range` action. */
interface TableRangeResponse {
  address?: string
  rowCount?: number
  columnCount?: number
}

function isSessionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { statusCode?: number; message?: string }
  if (candidate.statusCode === 404 || candidate.statusCode === 400 || candidate.statusCode === 409) {
    const message = (candidate.message ?? '').toLowerCase()
    return message.includes('session')
  }
  return false
}

export class GraphStorage implements IStorage {
  readonly mode = 'live' as const

  private readonly msal: ConfidentialClientApplication
  private readonly client: Client
  private sessionId: string | null = null

  constructor(readonly config: GraphStorageConfig) {
    this.msal = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    })
    // Custom middleware chain WITHOUT the built-in RetryHandler: retry/backoff
    // is owned by withRetry so behaviour is deterministic and observable.
    const authHandler = new AuthenticationHandler({
      getAccessToken: () => this.acquireToken(),
    })
    this.client = Client.initWithMiddleware({
      middleware: [authHandler, new HTTPMessageHandler()],
    })
  }

  private async acquireToken(): Promise<string> {
    const result = await this.msal.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    })
    if (!result || !result.accessToken) {
      throw new Error('MSAL did not return an access token for the Graph client-credentials flow')
    }
    return result.accessToken
  }

  /** Visible for graph:check (AUTH step). */
  async authenticate(): Promise<string> {
    return this.acquireToken()
  }

  /** Resolve the workbook file name (LOCATE step of graph:check). */
  async workbookName(): Promise<string> {
    const item = await this.client
      .api(`/drives/${this.config.driveId}/items/${this.config.fileItemId}`)
      .get()
    const name = (item as { name?: string })?.name
    return name ?? '(unknown)'
  }

  private base(): string {
    return `/drives/${this.config.driveId}/items/${this.config.fileItemId}/workbook`
  }

  private async createSession(): Promise<string> {
    const response = await this.client
      .api(`${this.base()}/createSession`)
      .post({ persistChanges: true }) as SessionResponse
    if (!response?.id) throw new Error('Graph createSession returned no session id')
    return response.id
  }

  private async ensureSession(): Promise<string> {
    this.sessionId ??= await this.createSession()
    return this.sessionId
  }

  private async refreshSession(): Promise<void> {
    this.sessionId = null
    await this.ensureSession()
  }

  /**
   * One Graph request with the workbook session header, one transparent
   * session refresh, and 429/503 backoff retries.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    skipSession = false
  ): Promise<T> {
    const attempt = async (): Promise<T> => {
      const headers: Record<string, string> = {}
      if (!skipSession) headers['workbook-session-id'] = await this.ensureSession()
      let api = this.client.api(`${this.base()}${path}`)
      if (Object.keys(headers).length > 0) {
        api = api.headers(headers)
      }
      let response: unknown
      if (method === 'GET') response = await api.get()
      else if (method === 'POST') response = await api.post(body)
      else if (method === 'PATCH') response = await api.patch(body)
      else response = await api.delete()
      return response as T
    }
    try {
      return await withRetry(attempt, { maxTries: 3 })
    } catch (error) {
      if (isSessionError(error)) {
        await this.refreshSession()
        return withRetry(attempt, { maxTries: 1 })
      }
      throw error
    }
  }

  async ensureWorkbook(): Promise<void> {
    for (const spec of WORKBOOK_SHEETS) {
      // Create the worksheet when missing (409/400 when it already exists).
      try {
        await this.request('POST', '/worksheets', { name: spec.sheet })
      } catch (error) {
        if (errorStatusIs(error, [400, 409])) {
          // Sheet already exists — expected on every run after the first.
        } else if (errorStatusIs(error, [404])) {
          throw new Error(
            `GraphStorage: workbook not found for drive ${this.config.driveId}, item ${this.config.fileItemId} — check GRAPH_DRIVE_ID / GRAPH_FILE_ITEM_ID`
          )
        } else {
          throw error
        }
      }

      const lastCol = columnLetter(spec.columns.length)
      // Write the header row (idempotent), then create the table if missing.
      // The PATCH also EXTENDS the header of a pre-existing narrower sheet —
      // new columns are appended at the end and data rows are untouched.
      await this.request('PATCH', `/worksheets/${spec.sheet}/range(address='A1:${lastCol}1')`, {
        values: [spec.columns],
      })
      try {
        await this.request(
          'POST',
          '/tables',
          {
            name: spec.table,
            address: `${spec.sheet}!A1:${lastCol}1`,
            hasHeaders: true,
          }
        )
      } catch (error) {
        if (!errorStatusIs(error, [400, 409])) throw error
        // Table already exists — expected on every run after the first.
        await this.recreateNarrowTable(spec)
      }
    }
  }

  /**
   * Schema migration for pre-existing tables: an Excel table is range
   * metadata, so when it spans FEWER columns than the spec (e.g. SkuMap
   * before the UOM extension) delete it and re-POST it over the full
   * extended range (header row + every data row). Cell data is untouched.
   */
  private async recreateNarrowTable(spec: WorkbookSheetSpec): Promise<void> {
    const range = await this.request<TableRangeResponse>('POST', `/tables/${spec.table}/range`)
    const columnCount = range?.columnCount
    const rowCount = range?.rowCount
    if (typeof columnCount !== 'number' || columnCount >= spec.columns.length) return
    const lastCol = columnLetter(spec.columns.length)
    await this.request('DELETE', `/tables/${spec.table}`)
    await this.request('POST', '/tables', {
      name: spec.table,
      address: `${spec.sheet}!A1:${lastCol}${Math.max(typeof rowCount === 'number' ? rowCount : 1, 1)}`,
      hasHeaders: true,
    })
  }

  async appendRows(sheet: string, rows: WorkbookCellValue[][]): Promise<void> {
    if (rows.length === 0) return
    const spec = sheetSpec(sheet)
    const values = rows.map((row) => row.map(cellOut))
    await this.request('POST', `/tables/${spec.table}/rows/add`, { index: null, values })
  }

  async readTable(sheet: string): Promise<WorkbookTableRow[]> {
    const spec = sheetSpec(sheet)
    const range = await this.request<RangeResponse>('GET', `/tables/${spec.table}/range`)
    const matrix = range?.values ?? []
    const [header, ...dataRows] = matrix
    if (!header) return []
    return dataRows.map((row) => {
      const record: WorkbookTableRow = {}
      header.forEach((name, index) => {
        record[cellKey(name)] = toCellValue(row[index])
      })
      return record
    })
  }

  async deleteRows(
    sheet: string,
    filter: (row: WorkbookTableRow) => boolean
  ): Promise<number> {
    const spec = sheetSpec(sheet)
    const response = await this.request<{ value?: TableRowEntity[] }>(
      'GET',
      `/tables/${spec.table}/rows`
    )
    const rows = response?.value ?? []
    const header = spec.columns
    const matches = rows
      .map((row) => ({ index: row.index, record: mapRow(header, row.values) }))
      .filter((entry) => filter(entry.record))
    // Delete bottom-up so earlier indexes stay valid while rows shift.
    for (const entry of [...matches].sort((a, b) => b.index - a.index)) {
      await this.request('DELETE', `/tables/${spec.table}/rows/itemAt(index=${entry.index})`)
    }
    return matches.length
  }

  async updateCell(
    sheet: string,
    rowNum: number,
    column: string,
    value: WorkbookCellValue
  ): Promise<void> {
    const spec = sheetSpec(sheet)
    const colIndex = spec.columns.indexOf(column)
    if (colIndex < 0) throw new Error(`GraphStorage: unknown column "${column}" on sheet "${sheet}"`)
    if (!Number.isInteger(rowNum) || rowNum < 1) {
      throw new Error('GraphStorage: rowNum must be a 1-based integer >= 1')
    }
    // Data row N lives at sheet row N+1 (row 1 is the header).
    const address = `${columnLetter(colIndex + 1)}${rowNum + 1}`
    await this.request('PATCH', `/worksheets/${spec.sheet}/range(address='${address}')`, {
      values: [[value]],
    })
  }

  async logAudit(entry: AuditLogEntry): Promise<void> {
    await this.appendRows('AuditLog', [auditEntryToCells(entry)])
  }

  /** Best-effort session cleanup (used by graph:check). */
  async closeSession(): Promise<void> {
    if (!this.sessionId) return
    const id = this.sessionId
    this.sessionId = null
    try {
      await this.client
        .api(`${this.base()}/closeSession`)
        .header('workbook-session-id', id)
        .post({})
    } catch {
      // Closing is advisory; expired sessions are reaped by Graph anyway.
    }
  }
}

function mapRow(columns: readonly string[], values: unknown[]): WorkbookTableRow {
  const record: WorkbookTableRow = {}
  columns.forEach((column, index) => {
    record[column] = toCellValue(values[index])
  })
  return record
}

function errorStatusIs(error: unknown, statuses: number[]): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { statusCode?: unknown }
  return typeof candidate.statusCode === 'number' && statuses.includes(candidate.statusCode)
}
