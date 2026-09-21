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
}

/** Conversion factor defaults when no mapping entry provides factors. */
export const DEFAULT_CS_FACTOR = 1
export const DEFAULT_DZ_FACTOR = 12

/** Pairwise quantity tolerance for the "Matched" status. */
export const QTY_TOLERANCE = 0.001
