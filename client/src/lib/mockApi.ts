/**
 * Fixture-backed implementation of RenuziApi. Mirrors the real backend's
 * behaviours — RBAC, the 18:00 WAT cutoff, location scoping, idempotent
 * submit (replace same date+location), audit logging — against data persisted
 * in localStorage. File parsing + reconciliation run client-side via
 * lib/xlsx.ts and lib/recon.ts (same semantics as the server engine).
 */
import {
  ApiError,
  type AuditEntry,
  type AuditListResult,
  type AuditQuery,
  type AuthUser,
  type RenuziApi,
  type ReconciliationRow,
  type SkuMappingEntry,
  type SkuMappingImportResult,
  type SubmitInput,
  type UnmappedSku,
  TOKEN_KEY,
} from './apiTypes'
import { generateSeedData, LOCATIONS, MOCK_USERS, seedMappings, type MockUser } from './fixtures'
import { bestMatch } from './fuzzy'
import {
  mergeManualCounts,
  reconcile,
  summarizeRows,
} from './recon'
import { isSubmissionOpen } from './wat'
import {
  parseLeverEdgeFile,
  parsePhysicalFile,
  parseXeroFile,
  type LeverEdgeItemRow,
  type PhysicalItemRow,
  type XeroItemRow,
} from './xlsx'

const KEYS = {
  recon: 'renuzi.mock.recon',
  mappings: 'renuzi.mock.skumap',
  audit: 'renuzi.mock.audit',
  unmapped: 'renuzi.mock.unmapped',
} as const

function readStore<T>(key: string, seed: () => T): T {
  const raw = localStorage.getItem(key)
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T
    } catch {
      // corrupted store — fall through and reseed
    }
  }
  const fresh = seed()
  localStorage.setItem(key, JSON.stringify(fresh))
  return fresh
}

function writeStore<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function reseed(): void {
  localStorage.removeItem(KEYS.recon)
  localStorage.removeItem(KEYS.audit)
  localStorage.removeItem(KEYS.unmapped)
}

let reconRows: ReconciliationRow[]
let mappings: SkuMappingEntry[]
let auditLog: AuditEntry[]
let unmappedQueue: UnmappedSku[]

function ensureSeeded(): void {
  reconRows = readStore(KEYS.recon, () => generateSeedData().reconRows)
  mappings = readStore(KEYS.mappings, () => seedMappings())
  auditLog = readStore(KEYS.audit, () => generateSeedData().audit)
  unmappedQueue = readStore(KEYS.unmapped, () => generateSeedData().unmapped)
}

function persistRecon(): void {
  writeStore(KEYS.recon, reconRows)
}

function persistMappings(): void {
  writeStore(KEYS.mappings, mappings)
}

function persistAudit(): void {
  writeStore(KEYS.audit, auditLog)
}

function persistUnmapped(): void {
  writeStore(KEYS.unmapped, unmappedQueue)
}

function delay(ms = 260 + Math.random() * 340): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toAuthUser(user: MockUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.location ? { location: user.location } : {}),
  }
}

function currentUser(): AuthUser {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token?.startsWith('mock.')) throw new ApiError('UNAUTHORIZED', 401)
  const user = MOCK_USERS.find((candidate) => candidate.id === token.slice('mock.'.length))
  if (!user) throw new ApiError('UNAUTHORIZED', 401)
  return toAuthUser(user)
}

function requireRole(user: AuthUser, ...roles: AuthUser['role'][]): void {
  if (!roles.includes(user.role)) throw new ApiError('FORBIDDEN', 403)
}

function logAudit(user: AuthUser, action: string, details: string, date: string | null = null, location: string | null = null): void {
  auditLog.push({
    Timestamp: new Date().toISOString(),
    Actor_ID: user.id,
    Actor_Email: user.email,
    Action: action,
    Date: date,
    Location: location,
    Details: details,
  })
  persistAudit()
}

/** Track unmapped SKUs seen during a submission for the admin review queue. */
function trackUnmapped(rows: ReconciliationRow[]): void {
  const candidates = mappings
    .filter((entry) => entry.active)
    .map((entry) => ({ code: entry.leverEdgeSkuCode, name: entry.leverEdgeItemName }))
  let added = 0
  for (const row of rows) {
    if (added >= 12) break
    if (row.Status !== 'Unmapped' && !row.Needs_Review) continue
    if (row.Item_Name === '') continue
    if (unmappedQueue.some((item) => item.sourceCode === row.SKU_Code)) continue
    const match = bestMatch(row.Item_Name, candidates)
    if (match === null) continue
    unmappedQueue.push({
      id: `u-${row.SKU_Code}`,
      sourceCode: row.SKU_Code,
      sourceName: row.Item_Name,
      suggestionCode: match.code,
      suggestionName: match.name,
      confidence: Math.min(0.99, Math.round(match.similarity * 100) / 100),
    })
    added += 1
  }
  persistUnmapped()
}

function coerceMapping(input: unknown): SkuMappingEntry {
  if (typeof input !== 'object' || input === null) {
    throw new ApiError('INVALID_SKU_MAPPING', 400)
  }
  const body = input as Record<string, unknown>
  const code = typeof body.leverEdgeSkuCode === 'string' ? body.leverEdgeSkuCode.trim() : ''
  if (code === '') throw new ApiError('INVALID_SKU_MAPPING', 400)
  const csFactor = Number(body.csFactor)
  const dzFactor = Number(body.dzFactor)
  return {
    leverEdgeSkuCode: code,
    leverEdgeItemName: typeof body.leverEdgeItemName === 'string' ? body.leverEdgeItemName : '',
    xeroItemCode: typeof body.xeroItemCode === 'string' ? body.xeroItemCode.trim() : '',
    xeroItemName: typeof body.xeroItemName === 'string' ? body.xeroItemName : '',
    csFactor: Number.isFinite(csFactor) && csFactor > 0 ? csFactor : 1,
    dzFactor: Number.isFinite(dzFactor) && dzFactor > 0 ? dzFactor : 12,
    category: typeof body.category === 'string' ? body.category : '',
    active: body.active === undefined ? true : Boolean(body.active),
  }
}

/** Minimal CSV parser (handles quoted fields and CRLF) — mirrors server parseCsv. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += char
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export const mockApi: RenuziApi = {
  async login(email, password) {
    await delay()
    if (email.trim() === '' || password === '') {
      throw new ApiError('EMAIL_AND_PASSWORD_REQUIRED', 400)
    }
    const user = MOCK_USERS.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
    )
    // Mock accepts any password for seeded users (see api.ts deviations).
    if (!user) throw new ApiError('INVALID_CREDENTIALS', 401)
    ensureSeeded()
    return { token: `mock.${user.id}`, user: toAuthUser(user) }
  },

  async me() {
    await delay(120)
    ensureSeeded()
    return currentUser()
  },

  async submitReconciliation(input: SubmitInput) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'warehouse_manager', 'admin')

    if (!input.leveredge || !input.xero) {
      throw new ApiError('MISSING_FILES', 400)
    }
    const { date, location } = input.counts
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || location.trim() === '') {
      throw new ApiError('INVALID_COUNTS_DATE', 400)
    }
    if (user.role === 'warehouse_manager') {
      const own = user.location?.toLowerCase()
      if (!own || own !== location.toLowerCase()) {
        throw new ApiError('LOCATION_FORBIDDEN', 403)
      }
    }
    if (!isSubmissionOpen(date)) {
      throw new ApiError('LOCKED_FOR_AUDIT', 403, 'Submissions lock at 6:00 PM WAT for executive audit.')
    }

    let leveredge: LeverEdgeItemRow[]
    let xeroAll: XeroItemRow[]
    let physical: PhysicalItemRow[]
    try {
      leveredge = (await parseLeverEdgeFile(input.leveredge)).rows
      xeroAll = (await parseXeroFile(input.xero)).rows
      physical = input.physical ? (await parsePhysicalFile(input.physical)).rows : []
    } catch (error) {
      throw new ApiError('UNPARSABLE_FILE', 422, (error as Error).message)
    }

    const xero = xeroAll.filter((row) => row.location.toLowerCase() === location.toLowerCase())
    const { merged, notesBySku } = mergeManualCounts(physical, input.counts.rows, location)

    const submittedAt = new Date().toISOString()
    const rows = reconcile({
      date,
      location,
      leveredge,
      xero,
      physical: merged,
      mapping: mappings,
      managerId: user.id,
      submittedAt,
      notes: input.counts.notes ?? null,
    })
    for (const row of rows) {
      const manualNote = notesBySku.get(row.SKU_Code)
      if (manualNote) {
        row.Notes = row.Notes === '' ? `Manual: ${manualNote}` : `${row.Notes}; Manual: ${manualNote}`
      }
    }
    const summary = summarizeRows(rows)

    const removed = reconRows.filter(
      (row) =>
        row.Date === date && row.Location.toLowerCase() === location.toLowerCase(),
    ).length
    reconRows = reconRows.filter(
      (row) =>
        !(row.Date === date && row.Location.toLowerCase() === location.toLowerCase()),
    )
    reconRows.push(...rows)
    persistRecon()
    trackUnmapped(rows)
    logAudit(
      user,
      'SUBMIT_RECONCILIATION',
      JSON.stringify({
        replacedRows: removed,
        rowCount: summary.rowCount,
        matched: summary.matched,
        discrepancy: summary.discrepancy,
        unmapped: summary.unmapped,
      }),
      date,
      location,
    )

    return {
      date,
      location,
      replacedRows: removed,
      parsed: {
        leveredge: leveredge.length,
        xero: xero.length,
        physical: physical.length,
        manualCounts: input.counts.rows.length,
      },
      summary,
    }
  },

  async getReconciliationStatus(date, location) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || location.trim() === '') {
      throw new ApiError('DATE_AND_LOCATION_REQUIRED', 400)
    }
    if (user.role === 'warehouse_manager') {
      const own = user.location?.toLowerCase()
      if (!own || own !== location.toLowerCase()) {
        throw new ApiError('LOCATION_FORBIDDEN', 403)
      }
    }
    const scoped = reconRows.filter(
      (row) =>
        row.Date === date && row.Location.toLowerCase() === location.toLowerCase(),
    )
    return {
      date,
      location,
      locked: !isSubmissionOpen(date),
      rowCount: scoped.length,
      summary: summarizeRows(scoped),
      rows: scoped,
    }
  },

  async listMappings() {
    await delay(160)
    ensureSeeded()
    currentUser() // any authenticated user (documented deviation)
    return mappings.filter((entry) => entry.leverEdgeSkuCode !== '')
  },

  async createMapping(entry) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const coerced = coerceMapping(entry)
    if (mappings.some((existing) => existing.leverEdgeSkuCode === coerced.leverEdgeSkuCode)) {
      throw new ApiError('SKU_MAPPING_EXISTS', 409)
    }
    mappings.push(coerced)
    mappings.sort((a, b) => a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode))
    persistMappings()
    logAudit(user, 'SKU_MAPPING_CHANGE', `Created mapping ${coerced.leverEdgeSkuCode}`)
    return coerced
  },

  async updateMapping(code, patch) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const index = mappings.findIndex(
      (entry) => entry.leverEdgeSkuCode === code.trim(),
    )
    if (index < 0) throw new ApiError('SKU_MAPPING_NOT_FOUND', 404)
    const merged = coerceMapping({ ...mappings[index], ...patch })
    if (
      mappings.some(
        (entry, i) => i !== index && entry.leverEdgeSkuCode === merged.leverEdgeSkuCode,
      )
    ) {
      throw new ApiError('SKU_MAPPING_EXISTS', 409)
    }
    mappings[index] = merged
    persistMappings()
    logAudit(user, 'SKU_MAPPING_CHANGE', `Updated mapping ${code.trim()}`)
    return merged
  },

  async deleteMapping(code) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const index = mappings.findIndex(
      (entry) => entry.leverEdgeSkuCode === code.trim(),
    )
    if (index < 0) throw new ApiError('SKU_MAPPING_NOT_FOUND', 404)
    const [removed] = mappings.splice(index, 1)
    persistMappings()
    logAudit(user, 'SKU_MAPPING_CHANGE', `Deleted mapping ${code.trim()}`)
    return removed
  },

  async importMappings(file) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const text = await file.text()
    const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''))
    const result: SkuMappingImportResult = { created: 0, updated: 0, total: 0, errors: [] }
    if (rows.length === 0) return result

    const headerIndex: Record<string, number> = {}
    rows[0].forEach((header, index) => {
      const name = header.trim()
      if (name !== '' && headerIndex[name] === undefined) headerIndex[name] = index
    })
    if (headerIndex.LeverEdge_SKU_Code === undefined) {
      throw new ApiError('IMPORT_FAILED', 400, 'CSV import: missing LeverEdge_SKU_Code header column')
    }

    const byCode = new Map(mappings.map((entry) => [entry.leverEdgeSkuCode, entry]))
    rows.slice(1).forEach((cells, offset) => {
      const at = (column: string): string => cells[headerIndex[column]]?.trim() ?? ''
      const code = at('LeverEdge_SKU_Code')
      if (code === '') {
        result.errors.push({ line: offset + 2, reason: 'blank LeverEdge_SKU_Code' })
        return
      }
      const csFactor = Number(at('CS_Factor'))
      const dzFactor = Number(at('DZ_Factor'))
      const entry: SkuMappingEntry = {
        leverEdgeSkuCode: code,
        leverEdgeItemName: at('LeverEdge_Item_Name'),
        xeroItemCode: at('Xero_Item_Code'),
        xeroItemName: at('Xero_Item_Name'),
        csFactor: Number.isFinite(csFactor) && csFactor > 0 ? csFactor : 1,
        dzFactor: Number.isFinite(dzFactor) && dzFactor > 0 ? dzFactor : 12,
        category: at('Category'),
        active: !['false', '0', 'no'].includes(at('Active').toLowerCase()),
      }
      if (byCode.has(code)) result.updated += 1
      else result.created += 1
      byCode.set(code, entry)
    })
    mappings = [...byCode.values()].sort((a, b) =>
      a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode),
    )
    result.total = mappings.length
    persistMappings()
    logAudit(
      user,
      'IMPORT_SKU_MAPPING',
      `CSV import: ${result.created} created, ${result.updated} updated (${result.total} total)`,
    )
    return result
  },

  async listAudit(query?: AuditQuery) {
    await delay(200)
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'executive', 'admin')
    const limit =
      typeof query?.limit === 'number' && query.limit > 0 && query.limit <= 1000 ? query.limit : 200
    const filtered = auditLog
      .filter((entry) => {
        if (query?.date && entry.Date !== query.date) return false
        if (query?.location && (entry.Location ?? '').toLowerCase() !== query.location.toLowerCase()) return false
        if (query?.action && entry.Action !== query.action) return false
        return true
      })
      .sort((a, b) => b.Timestamp.localeCompare(a.Timestamp))
    const result: AuditListResult = { count: filtered.length, entries: filtered.slice(0, limit) }
    return result
  },

  async listUsers() {
    await delay(140)
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    return MOCK_USERS.map(toAuthUser)
  },

  async listLocations() {
    await delay(80)
    ensureSeeded()
    const derived = new Set<string>(LOCATIONS)
    for (const row of reconRows) {
      if (row.Location.trim() !== '') derived.add(row.Location.trim())
    }
    return [...derived]
  },

  async listUnmappedSkus() {
    await delay(200)
    ensureSeeded()
    currentUser()
    return unmappedQueue
  },

  async resolveUnmappedSku(item) {
    await delay()
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const entry = coerceMapping({
      leverEdgeSkuCode: item.sourceCode,
      leverEdgeItemName: item.sourceName,
      xeroItemCode: item.suggestionCode,
      xeroItemName: item.suggestionName,
      csFactor: 1,
      dzFactor: 12,
      category: 'Unclassified',
      active: true,
    })
    if (mappings.some((existing) => existing.leverEdgeSkuCode === entry.leverEdgeSkuCode)) {
      throw new ApiError('SKU_MAPPING_EXISTS', 409)
    }
    mappings.push(entry)
    mappings.sort((a, b) => a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode))
    persistMappings()
    unmappedQueue = unmappedQueue.filter((candidate) => candidate.id !== item.id)
    persistUnmapped()
    logAudit(user, 'SKU_MAPPING_CHANGE', `Accepted fuzzy mapping ${entry.leverEdgeSkuCode}`)
    return entry
  },

  async dismissUnmappedSku(id) {
    await delay(160)
    ensureSeeded()
    const user = currentUser()
    requireRole(user, 'admin')
    const previous = unmappedQueue.length
    unmappedQueue = unmappedQueue.filter((item) => item.id !== id)
    persistUnmapped()
    if (unmappedQueue.length !== previous) {
      logAudit(user, 'SKU_MAPPING_CHANGE', `Dismissed unmapped suggestion ${id}`)
    }
  },
}

/** Test/demo helper — wipe persisted mock data and regenerate from fixtures. */
export function resetMockData(): void {
  reseed()
  ensureSeeded()
}
