/**
 * Client-side reconciliation engine — mirrors server/src/services/reconciliation.ts
 * (group join over code/name/fuzzy matching + workbook formulas) and
 * services/skuMatching.ts. Used by the /submit preview table and by mockApi's
 * submit pipeline; the live backend is the authoritative engine on submit.
 */
import type {
  ManualCountRow,
  ReconSummary,
  ReconciliationRow,
  SkuMappingEntry,
} from './apiTypes'
import { FUZZY_THRESHOLD, diceCoefficient, normalizeItemName } from './fuzzy'
import type { LeverEdgeItemRow, PhysicalItemRow, XeroItemRow } from './xlsx'

export const DEFAULT_CS_FACTOR = 1
export const DEFAULT_DZ_FACTOR = 12
export const QTY_TOLERANCE = 0.001
/** |Total Variance| at or above this requires a mandatory manager note. */
export const NOTE_VARIANCE_THRESHOLD = 10

type Method = 'code' | 'name' | 'fuzzy' | 'none'
const METHOD_RANK: Record<Method, number> = { code: 3, name: 2, fuzzy: 1, none: 0 }

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function qtyEquals(a: number, b: number, tolerance = QTY_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance
}

interface SourceAggregate {
  sku: string
  name: string
  qty: number
  unitPrice: number | null
}

interface PhysicalAggregate {
  sku: string
  name: string
  cs: number
  dz: number
  pc: number
  unitPrice: number | null
}

interface Group {
  key: string
  rank: number
  fuzzyJoined: boolean
  similarity: number | null
  entry: SkuMappingEntry | null
  sources: Set<'leveredge' | 'xero' | 'physical'>
  leverEdge: SourceAggregate | null
  xero: SourceAggregate | null
  physical: PhysicalAggregate | null
}

type SourceName = 'leveredge' | 'xero' | 'physical'
/** Group key -> sources already contributing (drives the cross-source merge guard). */
type GroupSources = Map<string, Set<SourceName>>

class Matcher {
  private readonly byCode = new Map<string, SkuMappingEntry>()
  private readonly mappingNames = new Map<string, string>()

  constructor(mapping: SkuMappingEntry[]) {
    for (const entry of mapping) {
      if (!entry.active) continue
      for (const code of [entry.leverEdgeSkuCode, entry.xeroItemCode]) {
        const trimmed = code.trim()
        if (trimmed !== '' && !this.byCode.has(trimmed)) this.byCode.set(trimmed, entry)
      }
      const key = `mapping:${entry.leverEdgeSkuCode.trim()}`
      for (const name of [entry.leverEdgeItemName, entry.xeroItemName]) {
        const normalized = normalizeItemName(name)
        if (normalized !== '' && !this.mappingNames.has(normalized)) {
          this.mappingNames.set(normalized, key)
        }
      }
    }
  }

  match(
    source: SourceName,
    sku: string,
    name: string,
    nameIndex: Map<string, string>,
    groupSources: GroupSources,
  ): {
    method: Method
    key: string | null
    similarity: number | null
    entry: SkuMappingEntry | null
  } {
    const hasSource = (key: string): boolean => groupSources.get(key)?.has(source) ?? false

    const entry = this.byCode.get(sku.trim())
    if (entry) {
      return {
        method: 'code',
        key: `mapping:${entry.leverEdgeSkuCode.trim()}`,
        similarity: null,
        entry,
      }
    }
    const normalized = normalizeItemName(name)
    if (normalized !== '') {
      const nameKey = nameIndex.get(normalized) ?? this.mappingNames.get(normalized)
      // Name/fuzzy joins are cross-source only — never merge two items from one export.
      if (nameKey && !hasSource(nameKey)) {
        return { method: 'name', key: nameKey, similarity: null, entry: null }
      }
      let bestKey: string | null = null
      let bestSimilarity = 0
      for (const [candidate, key] of nameIndex) {
        if (candidate === '' || hasSource(key)) continue
        const similarity = diceCoefficient(normalized, candidate)
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestKey = key
        }
      }
      if (bestKey !== null && bestSimilarity >= FUZZY_THRESHOLD) {
        return { method: 'fuzzy', key: bestKey, similarity: round3(bestSimilarity), entry: null }
      }
    }
    return { method: 'none', key: null, similarity: null, entry: null }
  }
}

export interface ReconcileInput {
  date: string
  location: string
  leveredge: LeverEdgeItemRow[]
  xero: XeroItemRow[]
  physical: PhysicalItemRow[]
  mapping: SkuMappingEntry[]
  managerId?: string | null
  submittedAt?: string | null
  notes?: string | null
}

export function reconcile(input: ReconcileInput): ReconciliationRow[] {
  const matcher = new Matcher(input.mapping)
  const groups = new Map<string, Group>()
  const nameIndex = new Map<string, string>()
  const groupSources: GroupSources = new Map()

  const resolve = (source: SourceName, sku: string, name: string): Group => {
    const match = matcher.match(source, sku, name, nameIndex, groupSources)
    const key = match.key ?? `unmapped:${source}:${sku}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        rank: 0,
        fuzzyJoined: false,
        similarity: null,
        entry: match.entry,
        sources: new Set(),
        leverEdge: null,
        xero: null,
        physical: null,
      }
      groups.set(key, group)
    }
    group.rank = Math.max(group.rank, METHOD_RANK[match.method])
    if (match.method === 'fuzzy') {
      group.fuzzyJoined = true
      if (group.similarity === null) group.similarity = match.similarity
    }
    if (match.entry && !group.entry) group.entry = match.entry
    group.sources.add(source)
    if (!groupSources.has(key)) groupSources.set(key, new Set())
    groupSources.get(key)!.add(source)
    const normalized = normalizeItemName(name)
    if (normalized !== '' && !nameIndex.has(normalized)) nameIndex.set(normalized, key)
    return group
  }

  for (const row of input.leveredge) {
    if (row.sku === '') continue
    const group = resolve('leveredge', row.sku, row.name)
    if (!group.leverEdge) {
      group.leverEdge = {
        sku: row.sku,
        name: row.name,
        qty: round3(row.qty ?? 0),
        unitPrice: row.unitPrice,
      }
    } else {
      group.leverEdge.qty = round3(group.leverEdge.qty + (row.qty ?? 0))
      group.leverEdge.unitPrice ??= row.unitPrice
    }
  }

  for (const row of input.xero) {
    if (row.sku === '') continue
    const group = resolve('xero', row.sku, row.name)
    if (!group.xero) {
      group.xero = {
        sku: row.sku,
        name: row.name,
        qty: round3(row.qty ?? 0),
        unitPrice: row.unitPrice,
      }
    } else {
      group.xero.qty = round3(group.xero.qty + (row.qty ?? 0))
      group.xero.unitPrice ??= row.unitPrice
    }
  }

  for (const row of input.physical) {
    if (row.sku === '') continue
    const group = resolve('physical', row.sku, row.name)
    if (!group.physical) {
      group.physical = {
        sku: row.sku,
        name: row.name,
        cs: round3(row.cs ?? 0),
        dz: round3(row.dz ?? 0),
        pc: round3(row.pc ?? 0),
        unitPrice: row.unitPrice,
      }
    } else {
      group.physical.cs = round3(group.physical.cs + (row.cs ?? 0))
      group.physical.dz = round3(group.physical.dz + (row.dz ?? 0))
      group.physical.pc = round3(group.physical.pc + (row.pc ?? 0))
      group.physical.unitPrice ??= row.unitPrice
    }
  }

  const rows = [...groups.values()].map((group) => buildRow(group, input))
  rows.sort(
    (a, b) =>
      (a.Item_Name < b.Item_Name ? -1 : a.Item_Name > b.Item_Name ? 1 : 0) ||
  rows.sort(
    (a, b) =>
      (a.Item_Name < b.Item_Name ? -1 : a.Item_Name > b.Item_Name ? 1 : 0) ||
      (a.SKU_Code < b.SKU_Code ? -1 : a.SKU_Code > b.SKU_Code ? 1 : 0),
  )
  return rows
}
  )
  return rows
}

function buildRow(group: Group, input: ReconcileInput): ReconciliationRow {
  const entry = group.entry
  const csFactor = entry?.csFactor ?? DEFAULT_CS_FACTOR
  const dzFactor = entry?.dzFactor ?? DEFAULT_DZ_FACTOR

  const leverEdgeQty = group.leverEdge?.qty ?? null
  const xeroQty = group.xero?.qty ?? null
  const physicalUnits = group.physical
    ? round3(
        (group.physical.cs ?? 0) * csFactor +
          (group.physical.dz ?? 0) * dzFactor +
          group.physical.pc,
        )
      )
    : null

  const docked =
    leverEdgeQty !== null && physicalUnits !== null ? round3(leverEdgeQty - physicalUnits) : null
  const undocked =
    physicalUnits !== null && xeroQty !== null ? round3(physicalUnits - xeroQty) : null
  const totalVariance =
    leverEdgeQty !== null && xeroQty !== null ? round3(leverEdgeQty - xeroQty) : null

  const unitPrice =
    group.leverEdge?.unitPrice ?? group.xero?.unitPrice ?? group.physical?.unitPrice ?? null
  const varianceValue =
    totalVariance !== null && unitPrice !== null ? round3(totalVariance * unitPrice) : null

  const shortage =
    leverEdgeQty !== null && xeroQty !== null ? round3(Math.max(xeroQty - leverEdgeQty, 0)) : null
  const surplus =
    leverEdgeQty !== null && xeroQty !== null ? round3(Math.max(leverEdgeQty - xeroQty, 0)) : null

  let status: ReconciliationRow['Status']
  if (group.rank === 0) {
    status = 'Unmapped'
  } else if (
    leverEdgeQty !== null &&
    xeroQty !== null &&
    physicalUnits !== null &&
    qtyEquals(leverEdgeQty, xeroQty) &&
    qtyEquals(physicalUnits, xeroQty) &&
    qtyEquals(physicalUnits, leverEdgeQty)
  ) {
    status = 'Matched'
  } else {
    status = 'Discrepancy'
  }

  const notes: string[] = []
  if (group.rank === 0) notes.push('No SKU mapping — add to SKUMapping')
  else if (group.fuzzyJoined && group.similarity !== null) {
    notes.push(`Auto-matched by name similarity ${group.similarity} — verify`)
  }
  if (input.notes) notes.push(input.notes)

  return {
    Date: input.date,
    Location: input.location,
    SKU_Code:
      group.leverEdge?.sku ??
      group.xero?.sku ??
      group.physical?.sku ??
      entry?.leverEdgeSkuCode ??
      '',
    Item_Name:
      group.leverEdge?.name ??
      group.xero?.name ??
      group.physical?.name ??
      entry?.leverEdgeItemName ??
      '',
    LeverEdge_Qty: leverEdgeQty,
    Xero_Qty: xeroQty,
    Physical_CS: group.physical?.cs ?? null,
    Physical_DZ: group.physical?.dz ?? null,
    Physical_PC: group.physical?.pc ?? null,
    Physical_Units: physicalUnits,
    Docked_Qty: docked,
    Undocked_Qty: undocked,
    Total_Variance: totalVariance,
    Unit_Price_NGN: unitPrice,
    Variance_Value_NGN: varianceValue,
    Shortage_Qty: shortage,
    Surplus_Qty: surplus,
    Sellable_Forward_Qty: surplus,
    Status: status,
    Needs_Review: group.rank === 0 || group.fuzzyJoined,
    Manager_ID: input.managerId ?? null,
    Submitted_At: input.submittedAt ?? null,
    Notes: notes.join('; '),
  }
}

/** Mirror of routes/reconciliation.ts mergeManualCounts (manual wins per SKU). */
export function mergeManualCounts(
  physical: PhysicalItemRow[],
  manual: ManualCountRow[],
  location: string,
): { merged: PhysicalItemRow[]; notesBySku: Map<string, string> } {
): { merged: PhysicalItemRow[]; notesBySku: Map<string, string> } {
  const notesBySku = new Map<string, string>()
  const merged = physical.map((row) => ({ ...row }))
  const bySku = new Map(merged.map((row) => [row.sku, row]))
  for (const count of manual) {
    const existing = bySku.get(count.sku)
    if (existing) {
      if (count.cs !== null) existing.cs = count.cs
      if (count.dz !== null) existing.dz = count.dz
      if (count.pc !== null) existing.pc = count.pc
    } else {
      const fresh: PhysicalItemRow = {
        sku: count.sku,
        name: '',
        cs: count.cs ?? 0,
        dz: count.dz ?? 0,
        pc: count.pc ?? 0,
        unitPrice: null,
        location,
      }
      merged.push(fresh)
      bySku.set(count.sku, fresh)
    }
    if (count.notes) notesBySku.set(count.sku, count.notes)
  }
  return { merged, notesBySku }
}

/** Mirror of services/reconciliation.ts summarizeRows + the submit response mapping. */
export function summarizeRows(rows: ReconciliationRow[]): ReconSummary {
  const summary: ReconSummary = {
    rowCount: rows.length,
    matched: 0,
    discrepancy: 0,
    unmapped: 0,
    needsReview: 0,
    atRiskSkus: 0,
    dockedQty: 0,
    dockedValueNGN: 0,
    undockedQty: 0,
    undockedValueNGN: 0,
    totalVarianceValueNGN: 0,
  }
  for (const row of rows) {
    if (row.Status === 'Matched') summary.matched += 1
    else if (row.Status === 'Discrepancy') summary.discrepancy += 1
    else summary.unmapped += 1
    if (row.Needs_Review) summary.needsReview += 1
    if (row.Docked_Qty !== null) {
      summary.dockedQty = round3(summary.dockedQty + row.Docked_Qty)
      if (row.Unit_Price_NGN !== null) {
        summary.dockedValueNGN = round3(
          summary.dockedValueNGN + row.Docked_Qty * row.Unit_Price_NGN,
        )
      }
    }
    if (row.Undocked_Qty !== null) {
      summary.undockedQty = round3(summary.undockedQty + row.Undocked_Qty)
      if (row.Unit_Price_NGN !== null) {
        summary.undockedValueNGN = round3(
          summary.undockedValueNGN + row.Undocked_Qty * row.Unit_Price_NGN,
        )
        )
      }
    }
    if (row.Variance_Value_NGN !== null) {
      summary.totalVarianceValueNGN = round3(summary.totalVarianceValueNGN + row.Variance_Value_NGN)
    }
  }
  summary.atRiskSkus = summary.needsReview
  return summary
}

// --- Preview rows (submission table) ---------------------------------------

export interface PreviewRow {
  sku: string
  name: string
  leverEdgeQty: number | null
  xeroQty: number | null
  cs: number
  dz: number
  pc: number
  csFactor: number
  dzFactor: number
  unitPrice: number | null
  fromPhysical: boolean
  unmapped: boolean
  needsReview: boolean
  note: string
}

export interface ComputedPreviewRow extends PreviewRow {
  physicalUnits: number
  docked: number
  undocked: number
  totalVariance: number
  status: 'Matched' | 'Discrepancy' | 'Unmapped'
  noteRequired: boolean
}

/**
 * Build the editable preview table from parsed sources joined over the mapping
 * (same grouping rules as reconcile(), flattened for live recompute).
 */
export function buildPreviewRows(
  sources: { leveredge: LeverEdgeItemRow[]; xero: XeroItemRow[]; physical: PhysicalItemRow[] },
  mapping: SkuMappingEntry[],
): PreviewRow[] {
): PreviewRow[] {
  const rows = reconcile({
    date: 'preview',
    location: 'preview',
    leveredge: sources.leveredge,
    xero: sources.xero,
    physical: sources.physical,
    mapping,
  })
  const byCode = new Map(mapping.map((entry) => [entry.leverEdgeSkuCode, entry]))
  return rows.map((row) => {
    const entry = byCode.get(row.SKU_Code) ?? null
    return {
      sku: row.SKU_Code,
      name: row.Item_Name,
      leverEdgeQty: row.LeverEdge_Qty,
      xeroQty: row.Xero_Qty,
      cs: row.Physical_CS ?? 0,
      dz: row.Physical_DZ ?? 0,
      pc: row.Physical_PC ?? 0,
      csFactor: entry?.csFactor ?? DEFAULT_CS_FACTOR,
      dzFactor: entry?.dzFactor ?? DEFAULT_DZ_FACTOR,
      unitPrice: row.Unit_Price_NGN,
      fromPhysical: row.Physical_Units !== null,
      unmapped: row.Status === 'Unmapped',
      needsReview: row.Needs_Review,
      note: '',
    }
  })
}

/** Recompute one row with the backend formulas (physical units -> variances). */
export function computePreviewRow(row: PreviewRow): ComputedPreviewRow {
  const physicalUnits = round3(row.cs * row.csFactor + row.dz * row.dzFactor + row.pc)
  const docked = row.leverEdgeQty !== null ? round3(row.leverEdgeQty - physicalUnits) : 0
  const undocked =
    row.xeroQty !== null ? round3(physicalUnits - row.xeroQty) : 0
  const totalVariance =
    row.leverEdgeQty !== null && row.xeroQty !== null
      ? round3(row.leverEdgeQty - row.xeroQty)
      : 0

  let status: ComputedPreviewRow['status'] = 'Unmapped'
  if (!row.unmapped) {
    if (
      row.leverEdgeQty !== null &&
      row.xeroQty !== null &&
      qtyEquals(physicalUnits, row.leverEdgeQty) &&
      qtyEquals(physicalUnits, row.xeroQty)
    ) {
      status = 'Matched'
    } else {
      status = 'Discrepancy'
    }
  }

  return {
    ...row,
    physicalUnits,
    docked,
    undocked,
    totalVariance,
    status,
    noteRequired: Math.abs(totalVariance) >= NOTE_VARIANCE_THRESHOLD,
  }
}

/** Summary for the sticky bar: docked value, unrecorded (undocked) units, at-risk SKUs. */
export function summarizePreview(rows: ComputedPreviewRow[]): {
  dockedValue: number
  unrecordedSales: number
  atRiskSkus: number
} {
  let dockedValue = 0
  let unrecordedSales = 0
  let atRiskSkus = 0
  for (const row of rows) {
    if (row.docked > 0 && row.unitPrice !== null) dockedValue += row.docked * row.unitPrice
    if (row.undocked > 0) unrecordedSales += row.undocked
    if (row.status !== 'Matched') atRiskSkus += 1
  }
  return { dockedValue: round3(dockedValue), unrecordedSales: round3(unrecordedSales), atRiskSkus }
}
