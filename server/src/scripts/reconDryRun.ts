import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUTPUT_DIR } from '../config.js'
import { buildDryRun } from '../services/dryRun.js'

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

function printSummary(report: ReturnType<typeof buildDryRun>): void {
  const columns = [
    ['Location', 10],
    ['Sources', 24],
    ['Rows', 6],
    ['Matched', 9],
    ['Discrep.', 9],
    ['Unmapped', 9],
    ['Review', 7],
  ] as const
  const header = columns.map(([name, width]) => name.padEnd(width)).join(' | ')
  const divider = '-'.repeat(header.length)

  console.log('RENZI STOCK RECON — DRY RUN (samples)')
  console.log(divider)
  console.log(header)
  console.log(divider)
  for (const run of report.runs) {
    const line = [
      run.location.padEnd(10),
      run.sources.join('+').padEnd(24),
      String(run.rowCount).padStart(String(columns[2][1]).length).padEnd(columns[2][1]),
      String(run.summary.matched).padStart(String(columns[3][1]).length).padEnd(columns[3][1]),
      String(run.summary.discrepancy).padStart(String(columns[4][1]).length).padEnd(columns[4][1]),
      String(run.summary.unmapped).padStart(String(columns[5][1]).length).padEnd(columns[5][1]),
      String(run.summary.needsReview).padStart(String(columns[6][1]).length).padEnd(columns[6][1]),
    ].join(' | ')
    console.log(line)
  }
  console.log(divider)
  const totals = report.totals
  console.log(`TOTAL rows           : ${totals.rowCount}`)
  console.log(`Matched / Discrepancy: ${totals.matched} / ${totals.discrepancy}`)
  console.log(`Unmapped / Review    : ${totals.unmapped} / ${totals.needsReview}`)
  console.log(
    `Docked qty (NGN)     : ${numberFormat.format(totals.dockedQty)} (${numberFormat.format(totals.totalDockedValueNGN)})`
  )
  console.log(
    `Undocked qty (NGN)   : ${numberFormat.format(totals.undockedQty)} (${numberFormat.format(totals.totalUndockedValueNGN)})`
  )
  console.log(`Total variance value : NGN ${numberFormat.format(totals.totalVarianceValueNGN)}`)
}

function main(): void {
  const report = buildDryRun()
  printSummary(report)

  const artifact = {
    generatedAt: new Date().toISOString(),
    ...report,
  }
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const target = join(OUTPUT_DIR, 'dry_run.json')
  writeFileSync(target, JSON.stringify(artifact, null, 2), 'utf-8')
  console.log(`\nWrote ${target}`)
}

main()
