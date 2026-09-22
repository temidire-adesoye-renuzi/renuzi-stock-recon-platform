import type { AuditLogEntry, SkuMappingEntry } from './schema.js'
import { SKUMAP_SHEET, skuEntryToCells, tableRowToSkuEntry } from './schema.js'
import { coerceSkuMappingInput, parseCsv } from './skuMappingStore.js'
import { getStorage, storageReady, storageTransaction } from './storage/index.js'
import type { AuthUser } from '../types.js'

/**
 * SKU mapping service backed by the SkuMap table in the master workbook
 * (Phase 3). The Phase 2 CSV seed remains only as a bulk-import source.
 */

export type SkuMappingOpResult =
  | { ok: true; entry: SkuMappingEntry }
  | { ok: false; error: 'SKU_MAPPING_EXISTS' | 'SKU_MAPPING_NOT_FOUND' | 'INVALID_SKU_MAPPING' }

export async function listMappings(): Promise<SkuMappingEntry[]> {
  await storageReady()
  const rows = await getStorage().readTable(SKUMAP_SHEET)
  return rows.map(tableRowToSkuEntry).filter((entry) => entry.leverEdgeSkuCode !== '')
}

function auditEntry(
  actor: AuthUser | undefined,
  action: AuditLogEntry['Action'],
  details: string
): AuditLogEntry {
  return {
    Timestamp: new Date().toISOString(),
    Actor_ID: actor?.id ?? 'system',
    Actor_Email: actor?.email ?? 'system@renuzi',
    Action: action,
    Date: null,
    Location: null,
    Details: details,
  }
}

export async function createMapping(
  input: unknown,
  actor?: AuthUser
): Promise<SkuMappingOpResult> {
  const coerced = coerceSkuMappingInput(input)
  if (!coerced.ok) return { ok: false, error: 'INVALID_SKU_MAPPING' }
  await storageReady()
  const storage = getStorage()
  const created = await storageTransaction(async () => {
    const existing = await storage.readTable(SKUMAP_SHEET)
    if (existing.some((row) => row.LeverEdge_SKU_Code === coerced.entry.leverEdgeSkuCode)) {
      return null
    }
    await storage.appendRows(SKUMAP_SHEET, [skuEntryToCells(coerced.entry)])
    await storage.logAudit(
      auditEntry(actor, 'SKU_MAPPING_CHANGE', `Created mapping ${coerced.entry.leverEdgeSkuCode}`)
    )
    return coerced.entry
  })
  if (created === null) return { ok: false, error: 'SKU_MAPPING_EXISTS' }
  return { ok: true, entry: created }
}

export async function updateMapping(
  code: string,
  input: unknown,
  actor?: AuthUser
): Promise<SkuMappingOpResult> {
  const coerced = coerceSkuMappingInput(input)
  if (!coerced.ok) return { ok: false, error: 'INVALID_SKU_MAPPING' }
  await storageReady()
  const storage = getStorage()
  const updated = await storageTransaction(async () => {
    const rows = await storage.readTable(SKUMAP_SHEET)
    const index = rows.findIndex((row) => row.LeverEdge_SKU_Code === code.trim())
    if (index < 0) return { missing: true as const }
    const merged = coerceSkuMappingInput({
      ...tableRowToSkuEntry(rows[index]),
      ...coerced.entry,
    })
    if (!merged.ok) return { invalid: true as const }
    const duplicate = rows.some(
      (row, i) => i !== index && row.LeverEdge_SKU_Code === merged.entry.leverEdgeSkuCode
    )
    if (duplicate) return { duplicate: true as const }
    const all = rows.map(tableRowToSkuEntry)
    all[index] = merged.entry
    await storage.deleteRows(SKUMAP_SHEET, () => true)
    await storage.appendRows(SKUMAP_SHEET, all.map(skuEntryToCells))
    await storage.logAudit(
      auditEntry(actor, 'SKU_MAPPING_CHANGE', `Updated mapping ${code.trim()}`)
    )
    return { entry: merged.entry }
  })
  if ('missing' in updated) return { ok: false, error: 'SKU_MAPPING_NOT_FOUND' }
  if ('invalid' in updated) return { ok: false, error: 'INVALID_SKU_MAPPING' }
  if ('duplicate' in updated) return { ok: false, error: 'SKU_MAPPING_EXISTS' }
  return { ok: true, entry: updated.entry }
}

export async function deleteMapping(code: string, actor?: AuthUser): Promise<SkuMappingOpResult> {
  await storageReady()
  const storage = getStorage()
  const removed = await storageTransaction(async () => {
    const rows = await storage.readTable(SKUMAP_SHEET)
    const target = rows.find((row) => row.LeverEdge_SKU_Code === code.trim())
    if (!target) return null
    const entry = tableRowToSkuEntry(target)
    await storage.deleteRows(SKUMAP_SHEET, (row) => row.LeverEdge_SKU_Code === code.trim())
    await storage.logAudit(
      auditEntry(actor, 'SKU_MAPPING_CHANGE', `Deleted mapping ${code.trim()}`)
    )
    return entry
  })
  if (removed === null) return { ok: false, error: 'SKU_MAPPING_NOT_FOUND' }
  return { ok: true, entry: removed }
}

export interface SkuMappingImportResult {
  created: number
  updated: number
  total: number
  errors: Array<{ line: number; reason: string }>
}

/**
 * Bulk-import SKU mappings from CSV text (same columns as the Phase 2 seed).
 * Upserts by LeverEdge SKU code inside one write transaction.
 */
export async function importMappingsFromCsv(
  csvText: string,
  actor?: AuthUser
): Promise<SkuMappingImportResult> {
  await storageReady()
  const storage = getStorage()

  const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim() !== ''))
  const result: SkuMappingImportResult = { created: 0, updated: 0, total: 0, errors: [] }
  if (rows.length === 0) return result

  const headerIndex: Record<string, number> = {}
  rows[0].forEach((header, index) => {
    const name = header.trim()
    if (name !== '' && headerIndex[name] === undefined) headerIndex[name] = index
  })
  if (headerIndex.LeverEdge_SKU_Code === undefined) {
    throw new Error('CSV import: missing LeverEdge_SKU_Code header column')
  }

  type Pending = { line: number; entry: SkuMappingEntry }
  const pending: Pending[] = []
  rows.slice(1).forEach((cells, offset) => {
    const at = (column: string) => cells[headerIndex[column]]?.trim() ?? ''
    const code = at('LeverEdge_SKU_Code')
    if (code === '') {
      result.errors.push({ line: offset + 2, reason: 'blank LeverEdge_SKU_Code' })
      return
    }
    const csFactor = Number(at('CS_Factor'))
    const dzFactor = Number(at('DZ_Factor'))
    pending.push({
      line: offset + 2,
      entry: {
        leverEdgeSkuCode: code,
        leverEdgeItemName: at('LeverEdge_Item_Name'),
        xeroItemCode: at('Xero_Item_Code'),
        xeroItemName: at('Xero_Item_Name'),
        csFactor: Number.isFinite(csFactor) && csFactor > 0 ? csFactor : 1,
        dzFactor: Number.isFinite(dzFactor) && dzFactor > 0 ? dzFactor : 12,
        category: at('Category'),
        active: !['false', '0', 'no'].includes(at('Active').toLowerCase()),
      },
    })
  })

  await storageTransaction(async () => {
    const existing = await storage.readTable(SKUMAP_SHEET)
    const byCode = new Map(
      existing.map((row) => [String(row.LeverEdge_SKU_Code ?? ''), tableRowToSkuEntry(row)])
    )
    for (const { entry } of pending) {
      if (byCode.has(entry.leverEdgeSkuCode)) result.updated += 1
      else {
        byCode.set(entry.leverEdgeSkuCode, entry)
        result.created += 1
      }
    }
    await storage.deleteRows(SKUMAP_SHEET, () => true)
    const finalEntries = [...byCode.values()].sort((a, b) =>
      a.leverEdgeSkuCode.localeCompare(b.leverEdgeSkuCode)
    )
    await storage.appendRows(
      SKUMAP_SHEET,
      finalEntries.map(skuEntryToCells)
    )
    result.total = finalEntries.length
    await storage.logAudit(
      auditEntry(
        actor,
        'IMPORT_SKU_MAPPING',
        `CSV import: ${result.created} created, ${result.updated} updated (${result.total} total)`
      )
    )
  })
  return result
}
