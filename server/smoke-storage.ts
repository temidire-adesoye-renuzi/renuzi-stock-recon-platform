import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { MockStorage } from './src/services/storage/mockStorage.js'
import { RECONCILIATION_SHEET, WORKBOOK_SHEETS, reconRowToCells, type ReconciliationRow } from './src/services/schema.js'

const dir = mkdtempSync(join(tmpdir(), 'renuzi-smoke-'))
const path = join(dir, 'master_workbook.xlsx')

const storage = new MockStorage(path)
await storage.ensureWorkbook()
console.log('file exists:', existsSync(path))

// verify with a fresh ExcelJS load: real tables with right names/headers
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(path)
for (const spec of WORKBOOK_SHEETS) {
  const ws = wb.getWorksheet(spec.sheet)
  const tables = ws?.getTables().map((entry) => entry[0].name)
  console.log(`sheet=${spec.sheet} tables=${JSON.stringify(tables)} ref=${ws?.getTables()[0]?.[0].ref}`)
}

const row: ReconciliationRow = {
  Date: '2026-09-22',
  Location: 'Ketu',
  SKU_Code: '65225884',
  Item_Name: 'CLOSEUP CFP 36X130G RC PROMO',
  LeverEdge_Qty: 141,
  Xero_Qty: 140,
  Physical_CS: 5,
  Physical_DZ: 2,
  Physical_PC: 1,
  Physical_Units: 61,
  Docked_Qty: 80,
  Undocked_Qty: -79,
  Total_Variance: 1,
  Unit_Price_NGN: 41365,
  Variance_Value_NGN: 41365,
  Shortage_Qty: 0,
  Surplus_Qty: 1,
  Sellable_Forward_Qty: 1,
  Status: 'Discrepancy',
  Needs_Review: false,
  Manager_ID: 'usr_ketu',
  Submitted_At: '2026-09-22T08:00:00.000Z',
  Notes: 'smoke',
}
await storage.appendRows(RECONCILIATION_SHEET, [reconRowToCells(row)])
await storage.appendRows(RECONCILIATION_SHEET, [reconRowToCells({ ...row, SKU_Code: '7791293049250', Item_Name: 'second' })])

let read = await storage.readTable(RECONCILIATION_SHEET)
console.log('rows after 2 appends:', read.length, read.map((r) => r.SKU_Code))

// table range after append
const wb2 = new ExcelJS.Workbook()
await wb2.xlsx.readFile(path)
console.log('table ref now:', wb2.getWorksheet('Reconciliation')?.getTables()[0]?.[0].ref)

const removed = await storage.deleteRows(RECONCILIATION_SHEET, (r) => r.SKU_Code === '7791293049250')
read = await storage.readTable(RECONCILIATION_SHEET)
console.log('removed:', removed, 'rows now:', read.length)

await storage.updateCell(RECONCILIATION_SHEET, 1, 'Notes', 'updated-note')
read = await storage.readTable(RECONCILIATION_SHEET)
console.log('updated cell Notes =', read[0].Notes)

// idempotent ensure keeps data
await storage.ensureWorkbook()
read = await storage.readTable(RECONCILIATION_SHEET)
console.log('after re-ensure rows:', read.length)

// sheetjs can open it too (Power BI-ish read sanity)
import * as XLSX from 'xlsx'
const sheetNames = XLSX.read(path).SheetNames
console.log('sheetjs opens file, sheets:', sheetNames)

rmSync(dir, { recursive: true, force: true })
console.log('SMOKE OK')
