import type { XeroItemRow } from '../schema.js'
import { cleanRows, findHeaderRow, readWorkbookRows, toNumber, toText } from '../xlsxHelpers.js'

const FIELDS = [
  { key: 'sku', names: ['Item Code'] },
  { key: 'name', names: ['Item Name'] },
  { key: 'unitPrice', names: ['Unit Sale Price'] },
  // The tracked quantity column is "XERO" — header case varies per sheet (XERO / xero).
  { key: 'qty', names: ['XERO'] },
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "KETU 18-SEP-26          " -> "Ketu" (sheet names carry trailing spaces). */
export function locationFromSheetName(sheetName: string): string {
  const word = sheetName.trim().split(/\s+/)[0] ?? ''
  if (word === '') return 'Unknown'
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Extract YYYY-MM-DD from a sheet name like "KETU 18-SEP-26". */
export function dateFromSheetName(sheetName: string): string | null {
  const match = sheetName.trim().match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\b/)
  if (!match) return null
  const day = Number(match[1])
  const month = MONTHS.indexOf(match[2].toUpperCase())
  let year = Number(match[3])
  if (year < 100) year += 2000
  if (month < 0 || day < 1 || day > 31) return null
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parse a Xero variant report export. Each sheet is one warehouse location
 * (e.g. "KETU 18-SEP-26", "LEKKI 18-SEP-26"); rows carry their location and
 * the sheet's audit date.
 */
export function parseXero(buffer: Buffer): XeroItemRow[] {
  const sheets = readWorkbookRows(buffer)
  const items: XeroItemRow[] = []

  for (const [sheetName, rows] of sheets) {
    const header = findHeaderRow(rows, FIELDS)
    if (!header) {
      throw new Error(
        `Xero export "${sheetName.trim()}": header row not found (expected Item Code / Item Name / Unit Sale Price / XERO)`
      )
    }
    const location = locationFromSheetName(sheetName)
    const sheetDate = dateFromSheetName(sheetName)

    for (const row of cleanRows(rows, header.index + 1)) {
      const sku = toText(row[header.columns.sku])
      if (sku === null) continue
      items.push({
        sku,
        name: toText(row[header.columns.name]) ?? '',
        qty: toNumber(row[header.columns.qty]) ?? 0,
        unitPrice: toNumber(row[header.columns.unitPrice]),
        location,
        sheetDate,
      })
    }
  }
  return items
}
