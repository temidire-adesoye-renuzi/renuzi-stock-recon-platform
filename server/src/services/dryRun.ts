import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SAMPLES_DIR, SKU_SEED_PATH } from '../config.js'
import type { ReconciliationRow, XeroItemRow } from './schema.js'
import { parseLeverEdge } from './parsers/leveredge.js'
import { parseXero } from './parsers/xero.js'
import { parsePhysical } from './parsers/physical.js'
import { loadSkuMapping } from './skuMappingStore.js'
import { mergeSummaries, reconcile, summarizeRows, type ReconSummary } from './reconciliation.js'

/**
 * Dry-run builder: parses the three sample exports, loads the SKU mapping
 * seed and runs the reconciliation engine per warehouse location. Pure (no
 * writes, no timestamps) so tests can snapshot it deterministically.
 *
 * The Xero workbook has one sheet per location. The LeverEdge and physical
 * samples are single-location files, so they feed the primary (first) run
 * only — other locations run Xero-only until per-location exports exist.
 */

export interface DryRunRun {
  location: string
  date: string
  sources: string[]
  rowCount: number
  summary: ReconSummary
  rows: ReconciliationRow[]
}

export interface DryRunReport {
  files: {
    leveredge: string
    xero: string
    physical: string
    mapping: string
  }
  runs: DryRunRun[]
  totals: ReconSummary
}

export function buildDryRun(
  samplesDir: string = SAMPLES_DIR,
  seedPath: string = SKU_SEED_PATH
): DryRunReport {
  const leveredge = parseLeverEdge(readFileSync(join(samplesDir, 'leveredge_sample.xlsx')))
  const xeroRows = parseXero(readFileSync(join(samplesDir, 'xero_sample.xlsx')))
  const physical = parsePhysical(readFileSync(join(samplesDir, 'physical_sample.xlsx')))
  const mapping = loadSkuMapping(seedPath)

  const byLocation = new Map<string, XeroItemRow[]>()
  for (const row of xeroRows) {
    const bucket = byLocation.get(row.location) ?? []
    bucket.push(row)
    byLocation.set(row.location, bucket)
  }

  const runs: DryRunRun[] = []
  let primary = true
  for (const [location, rows] of byLocation) {
    const date = rows[0]?.sheetDate ?? ''
    const sources = primary ? ['leveredge', 'xero', 'physical'] : ['xero']
    const reconciliation = primary
      ? reconcile({ date, location, leveredge, xero: rows, physical, mapping })
      : reconcile({ date, location, leveredge: [], xero: rows, physical: [], mapping })
    runs.push({
      location,
      date,
      sources,
      rowCount: reconciliation.length,
      summary: summarizeRows(reconciliation),
      rows: reconciliation,
    })
    primary = false
  }

  return {
    files: {
      leveredge: 'samples/leveredge_sample.xlsx',
      xero: 'samples/xero_sample.xlsx',
      physical: 'samples/physical_sample.xlsx',
      mapping: 'samples/sku_seed.csv',
    },
    runs,
    totals: mergeSummaries(runs.map((run) => run.summary)),
  }
}
