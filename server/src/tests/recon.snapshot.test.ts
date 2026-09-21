import { describe, expect, it } from 'vitest'
import { buildDryRun } from '../services/dryRun.js'

/**
 * Full-pipeline snapshot over the real /samples exports. If a sample file or
 * the sku_seed.csv changes intentionally, review the diff and update the
 * snapshot with `npx vitest run -u`.
 */
describe('full reconciliation of the /samples files', () => {
  const report = buildDryRun()

  it('runs one reconciliation per Xero location sheet', () => {
    expect(report.runs.map((run) => run.location)).toEqual(['Ketu', 'Lekki'])
    expect(report.runs[0].sources).toEqual(['leveredge', 'xero', 'physical'])
    expect(report.runs[1].sources).toEqual(['xero'])
    expect(report.runs.every((run) => run.date === '2026-09-18')).toBe(true)
  })

  it('parses every data row from the three sources', () => {
    // 96 leveredge + 54 ketu xero + 310 physical joined into Ketu groups,
    // plus 82 lekki xero rows as xero-only groups.
    expect(report.totals.rowCount).toBe(441)
    expect(report.totals.unmapped).toBe(386)
    expect(report.totals.discrepancy).toBe(55)
  })

  it('matches the committed snapshot', () => {
    expect(report).toMatchSnapshot()
  })
})
