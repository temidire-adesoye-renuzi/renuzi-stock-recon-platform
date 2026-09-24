/**
 * Single source of truth for the Reconciliation sheet schema (Master Excel
 * workbook) plus the in-memory dataset and SKU-mapping types shared by the
 * parsers, the SKU matching service and the reconciliation engine.
 */

export type ReconciliationStatus = 'Matched' | 'Discrepancy' | 'Unmapped'

/** Column order of the Reconciliation sheet in the Master workbook. */
export const RECONCILIATION_COLUMNS = [
  'Date',
  'Location',
  'SKU_Code',
  'Item_Name',
  'LeverEdge_Qty',
  'Xero_Qty',
  'Physical_CS',
  'Physical_DZ',
  'Physical_PC',
  'Physical_Units',
  'Docked_Qty',
  'Undocked_Qty',
  'Total_Variance',
  'Unit_Price_NGN',
  'Variance_Value_NGN',
  'Shortage_Qty',
  'Surplus_Qty',
  'Sellable_Forward_Qty',
  'Status',
  'Needs_Review',
  'Manager_ID',
  'Submitted_At',
  'Notes',
] as const

export type ReconciliationColumnName = (typeof RECONCILIATION_COLUMNS)[number]

/**
 * One row of the Reconciliation sheet. Quantities are rounded to 3 decimal
 * places; null means "source did not report this item" (never zero).
 */
export interface ReconciliationRow {
  Date: string
  Location: string
  SKU_Code: string
  Item_Name: string
  LeverEdge_Qty: number | null
  Xero_Qty: number | null
  Physical_CS: number | null
  Physical_DZ: number | null
  Physical_PC: number | null
  Physical_Units: number | null
  Docked_Qty: number | null
  Undocked_Qty: number | null
  Total_Variance: number | null
  Unit_Price_NGN: number | null
  Variance_Value_NGN: number | null
  Shortage_Qty: number | null
  Surplus_Qty: number | null
  Sellable_Forward_Qty: number | null
  Status: ReconciliationStatus
  Needs_Review: boolean
  Manager_ID: string | null
  Submitted_At: string | null
  Notes: string
}

/** LeverEdge export row (sku is ALWAYS a trimmed string — barcodes must survive). */
export interface LeverEdgeItemRow {
  sku: string
  name: string
  qty: number | null
  unitPrice: number | null
}

/** Xero export row — one sheet per warehouse location. */
export interface XeroItemRow extends LeverEdgeItemRow {
  location: string
  sheetDate: string | null
}

/** Physical stock count row (cases / dozens / pieces). */
export interface PhysicalItemRow {
  sku: string
  name: string
  cs: number | null
  dz: number | null
  pc: number | null
  unitPrice: number | null
  location: string | null
}

/** Header of samples/sku_seed.csv — Phase 3 migrates this to the SKUMapping sheet. */
export const SKU_MAPPING_CSV_COLUMNS = [
  'LeverEdge_SKU_Code',
  'LeverEdge_Item_Name',
  'Xero_Item_Code',
  'Xero_Item_Name',
  'CS_Factor',
  'DZ_Factor',
  'Category',
  'Active',
] as const

export interface SkuMappingEntry {
  leverEdgeSkuCode: string
  leverEdgeItemName: string
  xeroItemCode: string
  xeroItemName: string
  csFactor: number
  dzFactor: number
  category: string
  active: boolean
  uom?: string | null
  uomQty?: number | null
  uomBasis?: string | null
}

/** Conversion factor defaults when no mapping entry provides factors. */
export const DEFAULT_CS_FACTOR = 1
export const DEFAULT_DZ_FACTOR = 12

/** Pairwise quantity tolerance for the "Matched" status. */
export const QTY_TOLERANCE = 0.001

/**
 * Master workbook layout (Phase 3). One sheet + one real Excel table per
 * concern; Power BI reads these tables directly.
 */
export interface WorkbookSheetSpec {
  sheet: string
  table: string
  columns: readonly string[]
}

export const RECONCILIATION_SHEET = 'Reconciliation'
export const RECONCILIATION_TABLE = 'ReconTable'
export const SKUMAP_SHEET = 'SkuMap'
export const SKUMAP_TABLE = 'SkuMap'
export const AUDITLOG_SHEET = 'AuditLog'
export const AUDITLOG_TABLE = 'AuditLog'

/**
 * Column order of the SkuMap sheet: the CSV seed headers plus the UOM
 * extension appended at the END (column order matters — old workbooks are
 * migrated in place). The CSV seed itself stays 8 columns; its rows simply
 * read back with null UOM fields.
 */
export const SKUMAP_COLUMNS = [
  ...SKU_MAPPING_CSV_COLUMNS,
  'UOM',
  'UOM_Qty',
  'UOM_Basis',
] as const

/** Column order of the AuditLog sheet. */
export const AUDITLOG_COLUMNS = [
  'Timestamp',
  'Actor_ID',
  'Actor_Email',
  'Action',
  'Date',
  'Location',
  'Details',
] as const

export type AuditAction =
  | 'SUBMIT_RECONCILIATION'
  | 'MIGRATE_SKU_SEED'
  | 'IMPORT_SKU_MAPPING'
  | 'SKU_MAPPING_CHANGE'
  | 'GRAPH_CHECK'

export interface AuditLogEntry {
  Timestamp: string
  Actor_ID: string
  Actor_Email: string
  Action: AuditAction | string
  Date: string | null
  Location: string | null
  Details: string
}

export const WORKBOOK_SHEETS: readonly WorkbookSheetSpec[] = [
  {
    sheet: RECONCILIATION_SHEET,
    table: RECONCILIATION_TABLE,
    columns: RECONCILIATION_COLUMNS,
  },
  { sheet: SKUMAP_SHEET, table: SKUMAP_TABLE, columns: SKUMAP_COLUMNS },
  { sheet: AUDITLOG_SHEET, table: AUDITLOG_TABLE, columns: AUDITLOG_COLUMNS },
]

/** Values a storage layer may persist into a workbook cell. */
export type WorkbookCellValue = string | number | boolean | null

/** A table row read back from storage, keyed by column name. */
export type WorkbookTableRow = Record<string, WorkbookCellValue>

export function sheetSpec(sheet: string): WorkbookSheetSpec {
  const spec = WORKBOOK_SHEETS.find((candidate) => candidate.sheet === sheet)
  if (!spec) throw new Error(`Unknown workbook sheet "${sheet}"`)
  return spec
}

export function reconRowToCells(row: ReconciliationRow): WorkbookCellValue[] {
  return RECONCILIATION_COLUMNS.map((column) => row[column] as WorkbookCellValue)
}

export function skuEntryToCells(entry: SkuMappingEntry): WorkbookCellValue[] {
  return [
    entry.leverEdgeSkuCode,
    entry.leverEdgeItemName,
    entry.xeroItemCode,
    entry.xeroItemName,
    entry.csFactor,
    entry.dzFactor,
    entry.category,
    entry.active,
    entry.uom ?? null,
    entry.uomQty ?? null,
    entry.uomBasis ?? null,
  ]
}

export function auditEntryToCells(entry: AuditLogEntry): WorkbookCellValue[] {
  return [
    entry.Timestamp,
    entry.Actor_ID,
    entry.Actor_Email,
    entry.Action,
    entry.Date,
    entry.Location,
    entry.Details,
  ]
}

/** Coerce a table cell back to a number (null when blank/invalid). */
export function cellToNumber(value: WorkbookCellValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Coerce a table cell back to trimmed text (null when blank). */
export function cellToText(value: WorkbookCellValue | undefined): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  return null
}

export function cellToBoolean(value: WorkbookCellValue | undefined): boolean {
  return value === true || value === 'true' || value === 'TRUE'
}

/** Map a storage table row back onto the typed ReconciliationRow shape. */
export function tableRowToReconRow(row: WorkbookTableRow): ReconciliationRow {
  const numberOrNull = (key: string) => cellToNumber(row[key])
  return {
    Date: cellToText(row.Date) ?? '',
    Location: cellToText(row.Location) ?? '',
    SKU_Code: cellToText(row.SKU_Code) ?? '',
    Item_Name: cellToText(row.Item_Name) ?? '',
    LeverEdge_Qty: numberOrNull('LeverEdge_Qty'),
    Xero_Qty: numberOrNull('Xero_Qty'),
    Physical_CS: numberOrNull('Physical_CS'),
    Physical_DZ: numberOrNull('Physical_DZ'),
    Physical_PC: numberOrNull('Physical_PC'),
    Physical_Units: numberOrNull('Physical_Units'),
    Docked_Qty: numberOrNull('Docked_Qty'),
    Undocked_Qty: numberOrNull('Undocked_Qty'),
    Total_Variance: numberOrNull('Total_Variance'),
    Unit_Price_NGN: numberOrNull('Unit_Price_NGN'),
    Variance_Value_NGN: numberOrNull('Variance_Value_NGN'),
    Shortage_Qty: numberOrNull('Shortage_Qty'),
    Surplus_Qty: numberOrNull('Surplus_Qty'),
    Sellable_Forward_Qty: numberOrNull('Sellable_Forward_Qty'),
    Status: (cellToText(row.Status) ?? 'Unmapped') as ReconciliationStatus,
    Needs_Review: cellToBoolean(row.Needs_Review),
    Manager_ID: cellToText(row.Manager_ID),
    Submitted_At: cellToText(row.Submitted_At),
    Notes: cellToText(row.Notes) ?? '',
  }
}

/** Map a storage table row back onto the typed SkuMappingEntry shape. */
export function tableRowToSkuEntry(row: WorkbookTableRow): SkuMappingEntry {
  return {
    leverEdgeSkuCode: cellToText(row.LeverEdge_SKU_Code) ?? '',
    leverEdgeItemName: cellToText(row.LeverEdge_Item_Name) ?? '',
    xeroItemCode: cellToText(row.Xero_Item_Code) ?? '',
    xeroItemName: cellToText(row.Xero_Item_Name) ?? '',
    csFactor: cellToNumber(row.CS_Factor) ?? DEFAULT_CS_FACTOR,
    dzFactor: cellToNumber(row.DZ_Factor) ?? DEFAULT_DZ_FACTOR,
    category: cellToText(row.Category) ?? '',
    active: cellToBoolean(row.Active),
    uom: cellToText(row.UOM),
    uomQty: cellToNumber(row.UOM_Qty),
    uomBasis: cellToText(row.UOM_Basis),
  }
}
