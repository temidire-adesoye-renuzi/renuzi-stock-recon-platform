import { describe, expect, it } from 'vitest'
import { reconcile, summarizeRows } from '../services/reconciliation.js'
import type {
  LeverEdgeItemRow,
  PhysicalItemRow,
  SkuMappingEntry,
  XeroItemRow,
} from '../services/schema.js'

const mappingEntry = (overrides: Partial<SkuMappingEntry> = {}): SkuMappingEntry => ({
  leverEdgeSkuCode: 'LE-1',
  leverEdgeItemName: 'ALPHA PRODUCT',
  xeroItemCode: 'XR-1',
  xeroItemName: 'ALPHA PRODUCT',
  csFactor: 24,
  dzFactor: 12,
  category: 'Test',
  active: true,
  ...overrides,
})

const leverEdge = (overrides: Partial<LeverEdgeItemRow> = {}): LeverEdgeItemRow => ({
  sku: 'LE-1',
  name: 'ALPHA PRODUCT',
  qty: 100,
  unitPrice: 1000,
  ...overrides,
})

const xero = (overrides: Partial<XeroItemRow> = {}): XeroItemRow => ({
  sku: 'XR-1',
  name: 'ALPHA PRODUCT',
  qty: 100,
  unitPrice: 1000,
  location: 'Ketu',
  sheetDate: '2026-09-18',
  ...overrides,
})

const physical = (overrides: Partial<PhysicalItemRow> = {}): PhysicalItemRow => ({
  sku: 'PH-1',
  name: 'ALPHA PRODUCT',
  cs: 0,
  dz: 0,
  pc: 100,
  unitPrice: 1000,
  location: 'MAIN WAREHOUSE',
  ...overrides,
})

const run = (parts: {
  leveredge?: LeverEdgeItemRow[]
  xero?: XeroItemRow[]
  physical?: PhysicalItemRow[]
  mapping?: SkuMappingEntry[]
}) =>
  reconcile({
    date: '2026-09-18',
    location: 'Ketu',
    leveredge: parts.leveredge ?? [],
    xero: parts.xero ?? [],
    physical: parts.physical ?? [],
    mapping: parts.mapping ?? [],
  })

describe('CS/DZ/PC conversion', () => {
  it('converts via mapping factors: CS*CS_Factor + DZ*DZ_Factor + PC', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 65 })],
      physical: [physical({ cs: 2, dz: 1, pc: 5 })],
      mapping: [mappingEntry({ csFactor: 24, dzFactor: 12 })],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].Physical_Units).toBe(65) // 2*24 + 1*12 + 5
  })

  it('uses DZ=12 and CS=1 defaults for unmapped physical-only rows', () => {
    const rows = run({
      physical: [physical({ sku: 'P-9', name: 'ZETA ITEM', cs: 3, dz: 2, pc: 7 })],
    })
    expect(rows[0].Physical_Units).toBe(3 * 1 + 2 * 12 + 7) // 34
    expect(rows[0].Status).toBe('Unmapped')
    expect(rows[0].Needs_Review).toBe(true)
  })
})

describe('formulas', () => {
  it('computes docked / undocked / total variance and legacy columns', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 100 })],
      xero: [xero({ qty: 90 })],
      physical: [physical({ pc: 95 })],
    })
    const row = rows[0]
    expect(row.Docked_Qty).toBe(5) // LE - Physical
    expect(row.Undocked_Qty).toBe(5) // Physical - Xero
    expect(row.Total_Variance).toBe(10) // LE - Xero
    expect(row.Shortage_Qty).toBe(0) // max(Xero - LE, 0)
    expect(row.Surplus_Qty).toBe(10) // max(LE - Xero, 0)
    expect(row.Sellable_Forward_Qty).toBe(10) // = Surplus
    expect(row.Variance_Value_NGN).toBe(10 * 1000)
  })

  it('computes shortage when Xero exceeds LeverEdge', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 90 })],
      xero: [xero({ qty: 100 })],
      physical: [physical({ pc: 95 })],
    })
    expect(rows[0].Shortage_Qty).toBe(10)
    expect(rows[0].Surplus_Qty).toBe(0)
    expect(rows[0].Sellable_Forward_Qty).toBe(0)
  })

  it('leaves formulas null when a required source is missing', () => {
    const rows = run({ leveredge: [leverEdge({ qty: 5 })] })
    const row = rows[0]
    expect(row.Docked_Qty).toBeNull()
    expect(row.Undocked_Qty).toBeNull()
    expect(row.Total_Variance).toBeNull()
    expect(row.Variance_Value_NGN).toBeNull()
    expect(row.Shortage_Qty).toBeNull()
    expect(row.Status).toBe('Unmapped')
  })

  it('prefers LeverEdge pricing, then Xero, then physical list price', () => {
    const prices = run({
      leveredge: [leverEdge({ unitPrice: 100 })],
      xero: [xero({ unitPrice: 200 })],
      physical: [physical({ unitPrice: 300 })],
    })
    expect(prices[0].Unit_Price_NGN).toBe(100)

    const noLeverEdge = run({
      xero: [xero({ unitPrice: 200 })],
      physical: [physical({ unitPrice: 300 })],
    })
    expect(noLeverEdge[0].Unit_Price_NGN).toBe(200)

    const physicalOnly = run({ physical: [physical({ unitPrice: 300 })] })
    expect(physicalOnly[0].Unit_Price_NGN).toBe(300)
  })
})

describe('decimal safety', () => {
  it('rounds formula outputs to 3dp without float drift', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 307.335 })],
      physical: [physical({ pc: 192 })],
    })
    expect(rows[0].Docked_Qty).toBe(115.335)
    expect(String(rows[0].Docked_Qty)).toBe('115.335')
  })

  it('preserves fractional quantities like 0.125 end to end', () => {
    const rows = run({
      leveredge: [
        leverEdge({
          sku: 'LUX85GDD',
          name: 'LUX BAR DREAM DELIGHT 48X85G',
          qty: 0.125,
          unitPrice: 33000,
        }),
      ],
    })
    expect(rows[0].LeverEdge_Qty).toBe(0.125)
    expect(String(rows[0].LeverEdge_Qty)).toBe('0.125')
  })
})

describe('status', () => {
  it('is Matched when all pairwise differences are < 0.001', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 10 })],
      xero: [xero({ qty: 10.0004 })],
      physical: [physical({ pc: 10.0004 })],
    })
    expect(rows[0].Status).toBe('Matched')
    expect(rows[0].Needs_Review).toBe(false)
  })

  it('is Discrepancy at exactly the 0.001 boundary', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 10 })],
      xero: [xero({ qty: 10.001 })],
      physical: [physical({ pc: 10 })],
    })
    expect(rows[0].Status).toBe('Discrepancy')
  })

  it('is Discrepancy when a matched row is missing a source', () => {
    const rows = run({
      leveredge: [leverEdge({ qty: 10 })],
      xero: [xero({ qty: 10 })],
    })
    expect(rows[0].Status).toBe('Discrepancy')
    expect(rows[0].Needs_Review).toBe(false)
  })
})

describe('grouping', () => {
  it('joins the three sources by normalized name without mapping', () => {
    const rows = run({
      leveredge: [leverEdge({ sku: 'A', name: 'ALPHA PRODUCT' })],
      xero: [xero({ sku: 'B', name: 'alpha—product' })],
      physical: [physical({ sku: 'C', name: ' Alpha  Product ' })],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].SKU_Code).toBe('A')
    expect(rows[0].Status).not.toBe('Unmapped')
  })

  it('never merges similar names within the same source', () => {
    const rows = run({
      leveredge: [
        leverEdge({ sku: 'A', name: 'REXONA MEN XTRACOOL 4X6X46ML', qty: 1 }),
        leverEdge({ sku: 'B', name: 'REXONA MEN XTRACOOL 4X6X50ML', qty: 2 }),
      ],
    })
    expect(rows).toHaveLength(2)
  })

  it('flags fuzzy cross-source joins as needsReview', () => {
    const rows = run({
      leveredge: [leverEdge({ sku: 'A', name: 'CLOSEUP TP TRIPLE FRESH RH 264X8.5', qty: 5 })],
      xero: [xero({ sku: 'B', name: 'CLOSEUP TP TRIPPLE FRESH RH 264X8.5', qty: 4 })],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].Needs_Review).toBe(true)
    expect(rows[0].Notes).toContain('similarity')
  })

  it('carries submission metadata onto every row', () => {
    const rows = reconcile({
      date: '2026-09-18',
      location: 'Lekki',
      leveredge: [leverEdge()],
      xero: [],
      physical: [],
      mapping: [mappingEntry()],
      managerId: 'usr_ketu',
      submittedAt: '2026-09-18T16:30:00.000Z',
      notes: 'late submission',
    })
    expect(rows[0].Date).toBe('2026-09-18')
    expect(rows[0].Location).toBe('Lekki')
    expect(rows[0].Manager_ID).toBe('usr_ketu')
    expect(rows[0].Submitted_At).toBe('2026-09-18T16:30:00.000Z')
    expect(rows[0].Notes).toContain('late submission')
  })

  it('sorts rows deterministically by item name then SKU', () => {
    const rows = run({
      leveredge: [
        leverEdge({ sku: 'B', name: 'BETA', qty: 1 }),
        leverEdge({ sku: 'A2', name: 'ALPHA', qty: 1 }),
        leverEdge({ sku: 'A1', name: 'ALPHA', qty: 1 }),
      ],
    })
    expect(rows.map((row) => row.SKU_Code)).toEqual(['A1', 'A2', 'B'])
  })
})

describe('summarizeRows', () => {
  it('counts statuses and totals docked/undocked NGN values', () => {
    const rows = run({
      leveredge: [
        leverEdge({ qty: 100 }),
        leverEdge({ sku: 'L2', name: 'BETA', qty: 10, unitPrice: 50 }),
      ],
      xero: [xero({ qty: 90 }), xero({ sku: 'X2', name: 'BETA', qty: 12 })],
      physical: [physical({ pc: 95 }), physical({ sku: 'P2', name: 'BETA', pc: 10 })],
    })
    const summary = summarizeRows(rows)
    expect(summary.rowCount).toBe(2)
    expect(summary.discrepancy).toBe(2)
    // ALPHA: docked 5*1000 + undocked 5*1000; BETA: docked 0, undocked -2*50
    expect(summary.dockedQty).toBe(5)
    expect(summary.undockedQty).toBe(3)
    expect(summary.totalDockedValueNGN).toBe(5000)
    expect(summary.totalUndockedValueNGN).toBe(4900)
  })
})
