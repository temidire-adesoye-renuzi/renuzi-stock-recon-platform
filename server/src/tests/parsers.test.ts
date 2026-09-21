import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { parseLeverEdge } from '../services/parsers/leveredge.js'
import { parseXero } from '../services/parsers/xero.js'
import { parsePhysical } from '../services/parsers/physical.js'
import {
  cleanRows,
  findHeaderRow,
  isTotalRow,
  normalizeHeaderName,
  toNumber,
  toText,
} from '../services/xlsxHelpers.js'

const SAMPLES_DIR = fileURLToPath(new URL('../../../samples', import.meta.url))
const sample = (name: string): Buffer => readFileSync(join(SAMPLES_DIR, name))

describe('findHeaderRow', () => {
  it('detects headers under a title block with flexible column order and casing', () => {
    const rows: unknown[][] = [
      ['BIG COMPANY REPORT', null, null],
      ['Printed 2026-09-18', null, null],
      [null, null, null],
      ['item name', 'Item  code', 'QTY'],
      ['Widget', 'W1', 3],
    ]
    const match = findHeaderRow(rows, [
      { key: 'sku', names: ['Item Code'] },
      { key: 'name', names: ['Item Name'] },
      { key: 'qty', names: ['QTY'] },
    ])
    expect(match).not.toBeNull()
    expect(match!.index).toBe(3)
    expect(match!.columns).toEqual({ sku: 1, name: 0, qty: 2 })
  })

  it('ignores punctuation and extra spaces in header names', () => {
    expect(normalizeHeaderName(' sellable  &Forward   cases ')).toBe('SELLABLE FORWARD CASES')
  })

  it('returns null when no row contains every required field', () => {
    const rows: unknown[][] = [
      ['Item Code', 'Item Name'],
      ['A', 'B'],
    ]
    expect(findHeaderRow(rows, [{ key: 'qty', names: ['Quantity On Hand'] }])).toBeNull()
  })

  it('detects the physical report header despite spread-out columns', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      XLSX.read(sample('physical_sample.xlsx'), { type: 'buffer' }).Sheets[
        'UKL Physical Stock Report'
      ],
      { header: 1, raw: true, defval: null, blankrows: true }
    )
    const match = findHeaderRow(rows, [
      { key: 'sku', names: ['SKU Code'] },
      { key: 'name', names: ['SKU Description'] },
      { key: 'cs', names: ['CS'] },
      { key: 'dz', names: ['DZ'] },
      { key: 'pc', names: ['PC'] },
      { key: 'unitPrice', names: ['List Price'] },
    ])
    expect(match).not.toBeNull()
    expect(match!.index).toBe(10)
    expect(rows[match!.index][match!.columns.sku]).toBe('SKU Code')
  })
})

describe('cleanRows', () => {
  it('skips empty rows and Total/Grand Total footers', () => {
    const rows: unknown[][] = [
      ['SKU', 'Name', 'Qty'],
      ['A1', 'Alpha', 1],
      [null, null, null],
      ['', '', ''],
      ['Total', null, 3],
      ['Grand Total', null, 3],
      [null, null, 'TOTAL CASES'],
      [null, 'TOTAL VALUE', 9],
      ['B2', 'Beta', 2],
    ]
    expect(cleanRows(rows, 1)).toEqual([
      ['A1', 'Alpha', 1],
      ['B2', 'Beta', 2],
    ])
  })

  it('recognizes total rows by their first non-blank cell', () => {
    expect(isTotalRow(['', null, 'Grand Total', 5])).toBe(true)
    expect(isTotalRow([null, 'TOTAL CASES'])).toBe(true)
    expect(isTotalRow(['Total revenue row', 1])).toBe(true)
    expect(isTotalRow(['KNORR CUBE', 1])).toBe(false)
  })

  it('converts dash cells to null', () => {
    expect(toText('-')).toBeNull()
    expect(toText(' - ')).toBeNull()
    expect(toNumber('-')).toBeNull()
    expect(toNumber('1,234.5')).toBe(1234.5)
    expect(toText('  padded  ')).toBe('padded')
  })
})

describe('LeverEdge parser', () => {
  it('finds the header under the title block and parses all data rows', () => {
    const items = parseLeverEdge(sample('leveredge_sample.xlsx'))
    expect(items).toHaveLength(91)
    expect(items[0]).toEqual({
      sku: '65225884',
      name: 'CLOSEUP CFP 36X130G RC PROMO',
      qty: 141,
      unitPrice: 41365,
    })
  })

  it('keeps alphanumeric SKU codes as trimmed strings', () => {
    const items = parseLeverEdge(sample('leveredge_sample.xlsx'))
    const lux = items.find((item) => item.sku === 'LUX85GCP')
    expect(lux?.name).toBe('LUX BAR CREAMY PERFECTION PW 48X85G')
    expect(typeof lux?.sku).toBe('string')
  })

  it('preserves 13-digit barcode SKUs exactly', () => {
    const items = parseLeverEdge(sample('leveredge_sample.xlsx'))
    const barcode = items.find((item) => item.sku === '7791293049250')
    expect(barcode).toBeDefined()
    expect(barcode!.sku).toBe('7791293049250')
    expect(barcode!.name).toBe('REXONA AP MEN B/SPRAY ACTIVE DRY 72HRS 200ML X 12')
    expect(barcode!.qty).toBe(3)
  })

  it('preserves barcode SKUs even when Excel stores them as numbers', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Inventory Item List'],
      ['RENUZI VENTURES LIMITED KGT'],
      [null],
      ['Item Code', 'Item Name', 'Unit Sale Price', 'Quantity On Hand'],
      [7791293049250, 'REXONA AP MEN B/SPRAY', 30000, 3],
      ['65225884', 'CLOSEUP CFP', 41365, 141],
      ['Total', null, null, 144],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Item List')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const items = parseLeverEdge(buffer)
    expect(items).toHaveLength(2)
    expect(items[0].sku).toBe('7791293049250')
    expect(typeof items[0].sku).toBe('string')
    expect(items[1].sku).toBe('65225884')
  })

  it('preserves fractional quantities without drift', () => {
    const items = parseLeverEdge(sample('leveredge_sample.xlsx'))
    expect(items.find((item) => item.sku === 'LUX85GDD')?.qty).toBe(0.125)
    expect(items.find((item) => item.sku === '32050304')?.qty).toBe(307.335)
    expect(items.find((item) => item.sku === '64401568')?.qty).toBe(2631.0014)
  })
})

describe('Xero parser', () => {
  it('parses every location sheet with trailing-space names', () => {
    const items = parseXero(sample('xero_sample.xlsx'))
    const locations = [...new Set(items.map((item) => item.location))]
    expect(locations).toEqual(['Ketu', 'Lekki'])

    const ketu = items.filter((item) => item.location === 'Ketu')
    const lekki = items.filter((item) => item.location === 'Lekki')
    expect(ketu).toHaveLength(54)
    expect(lekki).toHaveLength(82)
  })

  it('matches the qty column case-insensitively (XERO vs xero) and skips totals', () => {
    const items = parseXero(sample('xero_sample.xlsx'))
    const ketu = items.filter((item) => item.location === 'Ketu')
    expect(ketu[0]).toMatchObject({ sku: '65225884', qty: 140, unitPrice: 41365 })
    expect(items.some((item) => item.name.includes('TOTAL'))).toBe(false)
  })

  it('keeps barcode SKUs intact and derives the audit date from the sheet name', () => {
    const items = parseXero(sample('xero_sample.xlsx'))
    const barcode = items.find((item) => item.sku === '7791293049250')
    expect(barcode?.location).toBe('Ketu')
    expect(barcode?.qty).toBe(3)
    expect(new Set(items.map((item) => item.sheetDate))).toEqual(new Set(['2026-09-18']))
  })
})

describe('Physical parser', () => {
  it('parses CS/DZ/PC columns and the location from the title block', () => {
    const items = parsePhysical(sample('physical_sample.xlsx'))
    expect(items).toHaveLength(310)
    expect(items[0]).toEqual({
      sku: '21033927',
      name: 'KNORR CHICKEN 6 X 1KG',
      cs: 0,
      dz: 0,
      pc: 0,
      unitPrice: 6634.86,
      location: 'MAIN WAREHOUSE',
    })
    const knorr = items.find((item) => item.sku === '64401562')
    expect(knorr).toMatchObject({ cs: 1175, dz: 0, pc: 4 })
  })

  it('skips the Grand Total footer row', () => {
    const items = parsePhysical(sample('physical_sample.xlsx'))
    expect(items.some((item) => item.sku === null || item.sku === '')).toBe(false)
    expect(
      items.every((item) => Number.isFinite((item.cs ?? 0) + (item.dz ?? 0) + (item.pc ?? 0)))
    ).toBe(true)
  })
})
