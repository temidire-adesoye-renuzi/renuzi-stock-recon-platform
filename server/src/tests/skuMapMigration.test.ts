import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS, { type Worksheet } from 'exceljs'
import { MockStorage } from '../services/storage/mockStorage.js'
import {
  AUDITLOG_COLUMNS,
  AUDITLOG_SHEET,
  AUDITLOG_TABLE,
  RECONCILIATION_COLUMNS,
  RECONCILIATION_SHEET,
  RECONCILIATION_TABLE,
  SKU_MAPPING_CSV_COLUMNS,
  SKUMAP_COLUMNS,
  SKUMAP_SHEET,
  SKUMAP_TABLE,
  auditEntryToCells,
  reconRowToCells,
  skuEntryToCells,
  tableRowToSkuEntry,
  type AuditLogEntry,
  type ReconciliationRow,
  type WorkbookCellValue,
} from '../services/schema.js'

/**
 * SkuMap schema-extension migration tests. An OLD workbook (table built from
 * the 8 CSV seed columns, before UOM/UOM_Qty/UOM_Basis existed) must boot,
 * gain the new columns, keep every existing value, and leave the untouched
 * sheets (Reconciliation, AuditLog) exactly as they were.
 */

const tempDir = mkdtempSync(join(tmpdir(), 'renuzi-skumap-migration-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

const OLD_SKUMAP_ROWS: WorkbookCellValue[][] = [
  ['L1', 'LUX BAR ONE', 'X1', 'LUX BAR UNO', 24, 12, 'Soap', true],
  ['L2', 'PEARS 90G', 'X2', 'PEARS BAR', 6, 12, 'Soap', false],
]

const RECON_ROW: ReconciliationRow = {
  Date: '2026-09-23',
  Location: 'Ketu',
  SKU_Code: 'L1',
  Item_Name: 'LUX BAR ONE',
  LeverEdge_Qty: 10,
  Xero_Qty: 9,
  Physical_CS: null,
  Physical_DZ: null,
  Physical_PC: null,
  Physical_Units: 10,
  Docked_Qty: 0,
  Undocked_Qty: 1,
  Total_Variance: 1,
  Unit_Price_NGN: 250,
  Variance_Value_NGN: 250,
  Shortage_Qty: 0,
  Surplus_Qty: 1,
  Sellable_Forward_Qty: 1,
  Status: 'Discrepancy',
  Needs_Review: true,
  Manager_ID: 'usr_ketu',
  Submitted_At: '2026-09-23T08:00:00.000Z',
  Notes: 'pre-migration row',
}

const AUDIT_ROW: AuditLogEntry = {
  Timestamp: '2026-09-23T08:05:00.000Z',
  Actor_ID: 'usr_admin',
  Actor_Email: 'admin@renuzi',
  Action: 'GRAPH_CHECK',
  Date: null,
  Location: null,
  Details: 'pre-migration audit row',
}

/** Build a workbook shaped like the PRE-extension release. */
async function writeOldWorkbook(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const columns = (names: readonly string[]) =>
    names.map((name) => ({ name, filterButton: false }))

  const skumap = wb.addWorksheet(SKUMAP_SHEET)
  skumap.addTable({
    name: SKUMAP_TABLE,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    columns: columns(SKU_MAPPING_CSV_COLUMNS),
    rows: OLD_SKUMAP_ROWS,
  })

  const recon = wb.addWorksheet(RECONCILIATION_SHEET)
  recon.addTable({
    name: RECONCILIATION_TABLE,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    columns: columns(RECONCILIATION_COLUMNS),
    rows: [reconRowToCells(RECON_ROW)],
  })

  const audit = wb.addWorksheet(AUDITLOG_SHEET)
  audit.addTable({
    name: AUDITLOG_TABLE,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    columns: columns(AUDITLOG_COLUMNS),
    rows: [auditEntryToCells(AUDIT_ROW)],
  })

  await wb.xlsx.writeFile(path)
}

function tableNames(ws: Worksheet): string[] {
  return ws
    .getTables()
    .map((entry) => {
      const value = Array.isArray(entry) ? entry[0] : (entry as unknown)
      return (value as { name?: string } | undefined)?.name
    })
    .filter((name): name is string => typeof name === 'string')
}

function headerValues(ws: Worksheet): string[] {
  const values = ws.getRow(1).values as unknown[]
  return SKUMAP_COLUMNS.map((_, index) => String(values[index + 1] ?? '').trim())
}

function rowValues(ws: Worksheet, rowNum: number): WorkbookCellValue[] {
  const values = ws.getRow(rowNum).values as unknown[]
  return SKUMAP_COLUMNS.map((_, index) => {
    const cell = values[index + 1]
    if (cell === undefined) return null
    return cell as WorkbookCellValue
  })
}

async function openSheet(path: string, sheet: string): Promise<Worksheet> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const ws = wb.getWorksheet(sheet)
  expect(ws).toBeDefined()
  return ws!
}

describe('SkuMap schema migration (old workbook → new spec)', () => {
  const path = join(tempDir, 'old-workbook.xlsx')

  it('migrates: new headers exist, old values preserved, new fields null', async () => {
    await writeOldWorkbook(path)
    await new MockStorage(path).ensureWorkbook()

    const ws = await openSheet(path, SKUMAP_SHEET)
    expect(tableNames(ws)).toContain(SKUMAP_TABLE)
    expect(headerValues(ws)).toEqual([...SKUMAP_COLUMNS])
    expect(SKUMAP_COLUMNS.slice(-3)).toEqual(['UOM', 'UOM_Qty', 'UOM_Basis'])

    expect(rowValues(ws, 2)).toEqual([...OLD_SKUMAP_ROWS[0], null, null, null])
    expect(rowValues(ws, 3)).toEqual([...OLD_SKUMAP_ROWS[1], null, null, null])
  })

  it('typed reads see the old values and null UOM fields', async () => {
    const rows = await new MockStorage(path).readTable(SKUMAP_SHEET)
    expect(rows).toHaveLength(2)
    expect(tableRowToSkuEntry(rows[0])).toMatchObject({
      leverEdgeSkuCode: 'L1',
      leverEdgeItemName: 'LUX BAR ONE',
      xeroItemCode: 'X1',
      xeroItemName: 'LUX BAR UNO',
      csFactor: 24,
      dzFactor: 12,
      category: 'Soap',
      active: true,
      uom: null,
      uomQty: null,
      uomBasis: null,
    })
  })

  it('leaves existing Reconciliation and AuditLog sheets untouched', async () => {
    const storage = new MockStorage(path)

    const recon = await storage.readTable(RECONCILIATION_SHEET)
    expect(recon).toHaveLength(1)
    expect(recon[0]).toMatchObject({
      Date: '2026-09-23',
      SKU_Code: 'L1',
      LeverEdge_Qty: 10,
      Xero_Qty: 9,
      Status: 'Discrepancy',
      Needs_Review: true,
      Notes: 'pre-migration row',
    })
    const reconWs = await openSheet(path, RECONCILIATION_SHEET)
    expect(tableNames(reconWs)).toContain(RECONCILIATION_TABLE)
    expect(reconWs.columnCount).toBe(RECONCILIATION_COLUMNS.length)

    const audit = await storage.readTable(AUDITLOG_SHEET)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ Actor_ID: 'usr_admin', Details: 'pre-migration audit row' })
    const auditWs = await openSheet(path, AUDITLOG_SHEET)
    expect(tableNames(auditWs)).toContain(AUDITLOG_TABLE)
    expect(auditWs.columnCount).toBe(AUDITLOG_COLUMNS.length)
  })

  it('stays stable and writable on subsequent boots', async () => {
    const storage = new MockStorage(path)
    await storage.ensureWorkbook() // second boot: headers now match, no rewrite

    const ws = await openSheet(path, SKUMAP_SHEET)
    expect(headerValues(ws)).toEqual([...SKUMAP_COLUMNS])
    expect(rowValues(ws, 2)).toEqual([...OLD_SKUMAP_ROWS[0], null, null, null])

    await storage.appendRows(
      SKUMAP_SHEET,
      [skuEntryToCells({
        leverEdgeSkuCode: 'L3',
        leverEdgeItemName: 'LUX BAR THREE',
        xeroItemCode: 'X3',
        xeroItemName: 'LUX BAR TRE',
        csFactor: 1,
        dzFactor: 12,
        category: 'Soap',
        active: true,
        uom: 'CS',
        uomQty: 24,
        uomBasis: 'master_v2',
      })]
    )
    const entries = (await storage.readTable(SKUMAP_SHEET)).map(tableRowToSkuEntry)
    expect(entries).toHaveLength(3)
    expect(entries[2]).toMatchObject({
      leverEdgeSkuCode: 'L3',
      uom: 'CS',
      uomQty: 24,
      uomBasis: 'master_v2',
    })
    expect(entries[0]).toMatchObject({ leverEdgeSkuCode: 'L1', uom: null })
  })
})

describe('Fresh workbook boot (full spec)', () => {
  it('creates every sheet/table with the extended SkuMap spec', async () => {
    const path = join(tempDir, 'fresh-workbook.xlsx')
    const storage = new MockStorage(path)
    await storage.ensureWorkbook()
    await storage.ensureWorkbook() // idempotent

    const ws = await openSheet(path, SKUMAP_SHEET)
    expect(tableNames(ws)).toContain(SKUMAP_TABLE)
    expect(headerValues(ws)).toEqual([...SKUMAP_COLUMNS])
    expect(await storage.readTable(SKUMAP_SHEET)).toEqual([])

    const reconWs = await openSheet(path, RECONCILIATION_SHEET)
    expect(reconWs.columnCount).toBe(RECONCILIATION_COLUMNS.length)
    const auditWs = await openSheet(path, AUDITLOG_SHEET)
    expect(auditWs.columnCount).toBe(AUDITLOG_COLUMNS.length)
  })

  it('round-trips entries without UOM data as nulls', async () => {
    const path = join(tempDir, 'uom-nulls.xlsx')
    const storage = new MockStorage(path)
    await storage.ensureWorkbook()
    await storage.appendRows(
      SKUMAP_SHEET,
      [skuEntryToCells({
        leverEdgeSkuCode: 'L1',
        leverEdgeItemName: 'LUX BAR ONE',
        xeroItemCode: 'X1',
        xeroItemName: 'LUX BAR UNO',
        csFactor: 24,
        dzFactor: 12,
        category: 'Soap',
        active: true,
      })]
    )
    const [entry] = (await storage.readTable(SKUMAP_SHEET)).map(tableRowToSkuEntry)
    expect(entry).toMatchObject({
      leverEdgeSkuCode: 'L1',
      uom: null,
      uomQty: null,
      uomBasis: null,
    })
  })
})
