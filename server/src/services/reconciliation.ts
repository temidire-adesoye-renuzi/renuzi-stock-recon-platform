import {
  DEFAULT_CS_FACTOR,
  DEFAULT_DZ_FACTOR,
  QTY_TOLERANCE,
  type LeverEdgeItemRow,
  type PhysicalItemRow,
  type ReconciliationRow,
  type ReconciliationStatus,
  type SkuMappingEntry,
  type XeroItemRow,
} from './schema.js'
import { SkuMatcher, normalizeItemName, type SkuMatchMethod } from './skuMatching.js'
import { qtyEquals, round3, sum3 } from './math.js'

/**
 * Reconciliation engine: joins the three daily sources (LeverEdge, Xero,
 * Physical) over the SKU mapping into Reconciliation-sheet rows.
 *
 * Formulas (PROJECT_CONTEXT):
 *   Physical_Units  = CS*CS_Factor + DZ*DZ_Factor + PC
 *   Docked          = LeverEdge - Physical_Units
 *   Undocked        = Physical_Units - Xero
 *   Total_Variance  = LeverEdge - Xero
 *   Shortage        = max(Xero - LeverEdge, 0)
 *   Surplus         = max(LeverEdge - Xero, 0)
 *   Sellable_Forward = Surplus
 */

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

export interface ReconSummary {
  rowCount: number
  matched: number
  discrepancy: number
  unmapped: number
  needsReview: number
  dockedQty: number
  undockedQty: number
  totalDockedValueNGN: number
  totalUndockedValueNGN: number
  totalVarianceValueNGN: number
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
  /** Strongest method that formed/merged this group: code > name > fuzzy > none. */
  rank: number
  /** True when any cross-source join relied on fuzzy matching. */
  fuzzyJoined: boolean
  similarity: number | null
  entry: SkuMappingEntry | null
  /** Sources already contributing to this group (name/fuzzy never merge within a source). */
  sources: Set<string>
  leverEdge: SourceAggregate | null
  xero: SourceAggregate | null
  physical: PhysicalAggregate | null
}

const METHOD_RANK: Record<SkuMatchMethod, number> = { code: 3, name: 2, fuzzy: 1, none: 0 }

export function reconcile(input: ReconcileInput): ReconciliationRow[] {
  const matcher = new SkuMatcher(input.mapping)
  const groups = new Map<string, Group>()
  /** normalized item name -> group key (drives name + fuzzy matching) */
  const nameIndex = new Map<string, string>()

  const resolve = (source: 'leveredge' | 'xero' | 'physical', sku: string, name: string): Group => {
    // Name/fuzzy matching joins items ACROSS sources only — never merge two
    // items from the same source (similar names within one export stay apart).
    const canMerge = (key: string): boolean => {
      const target = groups.get(key)
      return target === undefined || !target.sources.has(source)
    }
    const match = matcher.match(sku, name, nameIndex, canMerge)
    const key = match.key ?? `unmapped:${source}:${sku}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        rank: 0,
        fuzzyJoined: false,
        similarity: null,
        entry: match.entry,
        sources: new Set<string>(),
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
      (a.SKU_Code < b.SKU_Code ? -1 : a.SKU_Code > b.SKU_Code ? 1 : 0)
  )
  return rows
}

function buildRow(group: Group, input: ReconcileInput): ReconciliationRow {
  const entry = group.entry
  const csFactor = entry?.csFactor ?? DEFAULT_CS_FACTOR
  const dzFactor = entry?.dzFactor ?? DEFAULT_DZ_FACTOR

  const leverEdgeQty = group.leverEdge?.qty ?? null
  const xeroQty = group.xero?.qty ?? null
  const cs = group.physical?.cs ?? null
  const dz = group.physical?.dz ?? null
  const pc = group.physical?.pc ?? null
  const physicalUnits = group.physical
    ? round3(
        (group.physical.cs ?? 0) * csFactor +
          (group.physical.dz ?? 0) * dzFactor +
          group.physical.pc
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

  // "Matched" only when all three sources reported the item AND every pairwise
  // difference is within tolerance. Groups that never matched anything (rank 0)
  // are "Unmapped"; anything else unverifiable is a "Discrepancy".
  let status: ReconciliationStatus
  if (group.rank === 0) {
    status = 'Unmapped'
  } else if (
    leverEdgeQty !== null &&
    xeroQty !== null &&
    physicalUnits !== null &&
    qtyEquals(leverEdgeQty, xeroQty, QTY_TOLERANCE) &&
    qtyEquals(physicalUnits, xeroQty, QTY_TOLERANCE) &&
    qtyEquals(physicalUnits, leverEdgeQty, QTY_TOLERANCE)
  ) {
    status = 'Matched'
  } else {
    status = 'Discrepancy'
  }

  // Needs review when the row never matched across sources/mapping, or when a
  // join relied on fuzzy name similarity.
  const needsReview = group.rank === 0 || group.fuzzyJoined

  const notes = buildNotes(group, input.notes ?? null)

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
    Physical_CS: cs,
    Physical_DZ: dz,
    Physical_PC: pc,
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
    Needs_Review: needsReview,
    Manager_ID: input.managerId ?? null,
    Submitted_At: input.submittedAt ?? null,
    Notes: notes,
  }
}

function buildNotes(group: Group, globalNotes: string | null): string {
  const parts: string[] = []
  if (group.rank === 0) parts.push('No SKU mapping — add to SKUMapping')
  else if (group.fuzzyJoined && group.similarity !== null) {
    parts.push(`Auto-matched by name similarity ${group.similarity} — verify`)
  }
  if (globalNotes) parts.push(globalNotes)
  return parts.join('; ')
}

export function summarizeRows(rows: ReconciliationRow[]): ReconSummary {
  const summary: ReconSummary = {
    rowCount: rows.length,
    matched: 0,
    discrepancy: 0,
    unmapped: 0,
    needsReview: 0,
    dockedQty: 0,
    undockedQty: 0,
    totalDockedValueNGN: 0,
    totalUndockedValueNGN: 0,
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
        summary.totalDockedValueNGN = round3(
          summary.totalDockedValueNGN + row.Docked_Qty * row.Unit_Price_NGN
        )
      }
    }
    if (row.Undocked_Qty !== null) {
      summary.undockedQty = round3(summary.undockedQty + row.Undocked_Qty)
      if (row.Unit_Price_NGN !== null) {
        summary.totalUndockedValueNGN = round3(
          summary.totalUndockedValueNGN + row.Undocked_Qty * row.Unit_Price_NGN
        )
      }
    }
    if (row.Variance_Value_NGN !== null) {
      summary.totalVarianceValueNGN = round3(summary.totalVarianceValueNGN + row.Variance_Value_NGN)
    }
  }
  return summary
}

export function mergeSummaries(summaries: ReconSummary[]): ReconSummary {
  return {
    rowCount: sum3(summaries.map((s) => s.rowCount)),
    matched: sum3(summaries.map((s) => s.matched)),
    discrepancy: sum3(summaries.map((s) => s.discrepancy)),
    unmapped: sum3(summaries.map((s) => s.unmapped)),
    needsReview: sum3(summaries.map((s) => s.needsReview)),
    dockedQty: sum3(summaries.map((s) => s.dockedQty)),
    undockedQty: sum3(summaries.map((s) => s.undockedQty)),
    totalDockedValueNGN: sum3(summaries.map((s) => s.totalDockedValueNGN)),
    totalUndockedValueNGN: sum3(summaries.map((s) => s.totalUndockedValueNGN)),
    totalVarianceValueNGN: sum3(summaries.map((s) => s.totalVarianceValueNGN)),
  }
}
