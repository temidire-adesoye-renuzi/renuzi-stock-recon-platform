import type { PhysicalItemRow } from '../schema.js'
import {
  cleanRows,
  findHeaderRow,
  readWorkbookRows,
  toNumber,
  toText,
  normalizeHeaderName,
} from '../xlsxHelpers.js'

const FIELDS = [
  { key: 'sku', names: ['SKU Code'] },
  { key: 'name', names: ['SKU Description'] },
  { key: 'cs', names: ['CS'] },
  { key: 'dz', names: ['DZ'] },
  { key: 'pc', names: ['PC'] },
  { key: 'unitPrice', names: ['List Price'] },
]

/** Find "Location : <value>" in the title block above the header row. */
function locationFromTitleBlock(rows: unknown[][], headerIndex: number): string | null {
  for (let r = 0; r < headerIndex; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      if (normalizeHeaderName(row[c]) !== 'LOCATION') continue
      for (let k = c + 1; k < row.length; k++) {
        const value = toText(row[k])
        if (value !== null) return value
      }
    }
  }
  return null
}

/**
 * Parse a physical stock count report. The header row (SKU Code / SKU
 * Description / CS / DZ / PC / List Price) sits ~10 rows down under a title
 * block that also names the location (e.g. MAIN WAREHOUSE). CS/DZ/PC are kept
 * separate; conversion to units happens in the reconciliation engine using the
 * SKU mapping factors.
 */
export function parsePhysical(buffer: Buffer): PhysicalItemRow[] {
  const sheets = readWorkbookRows(buffer)
  const firstSheet = [...sheets.values()][0]
  if (!firstSheet) throw new Error('Physical stock report: workbook has no sheets')

  const header = findHeaderRow(firstSheet, FIELDS)
  if (!header) {
    throw new Error(
      'Physical stock report: header row not found (expected SKU Code / SKU Description / CS / DZ / PC / List Price)'
    )
  }
  const location = locationFromTitleBlock(firstSheet, header.index)

  const items: PhysicalItemRow[] = []
  for (const row of cleanRows(firstSheet, header.index + 1)) {
    const sku = toText(row[header.columns.sku])
    if (sku === null) continue
    items.push({
      sku,
      name: toText(row[header.columns.name]) ?? '',
      cs: toNumber(row[header.columns.cs]) ?? 0,
      dz: toNumber(row[header.columns.dz]) ?? 0,
      pc: toNumber(row[header.columns.pc]) ?? 0,
      unitPrice: toNumber(row[header.columns.unitPrice]),
      location,
    })
  }
  return items
}
