import type { LeverEdgeItemRow } from '../schema.js'
import { cleanRows, findHeaderRow, readWorkbookRows, toNumber, toText } from '../xlsxHelpers.js'

const FIELDS = [
  { key: 'sku', names: ['Item Code'] },
  { key: 'name', names: ['Item Name'] },
  { key: 'unitPrice', names: ['Unit Sale Price'] },
  { key: 'qty', names: ['Quantity On Hand'] },
]

/**
 * Parse a LeverEdge "Inventory Item List" export. SKU codes are coerced to
 * trimmed strings (alphanumeric codes like LUX85GCP and 13-digit barcodes like
 * 7791293049250 must never become numbers); fractional quantities (0.125)
 * are preserved.
 */
export function parseLeverEdge(buffer: Buffer): LeverEdgeItemRow[] {
  const sheets = readWorkbookRows(buffer)
  const firstSheet = [...sheets.values()][0]
  if (!firstSheet) throw new Error('LeverEdge export: workbook has no sheets')

  const header = findHeaderRow(firstSheet, FIELDS)
  if (!header) {
    throw new Error(
      'LeverEdge export: header row not found (expected Item Code / Item Name / Unit Sale Price / Quantity On Hand)'
    )
  }

  const items: LeverEdgeItemRow[] = []
  for (const row of cleanRows(firstSheet, header.index + 1)) {
    const sku = toText(row[header.columns.sku])
    if (sku === null) continue
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? '',
      qty: toNumber(row[header.columns.qty]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice]),
    })
  }
  return items
}
