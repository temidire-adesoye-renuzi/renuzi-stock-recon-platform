import {
  currentGraphMode,
  GraphStorage,
  readGraphEnv,
  missingGraphEnvVars,
} from '../services/storage/index.js'
import { lagosDateString } from '../services/cutoff.js'
import {
  RECONCILIATION_SHEET,
  reconRowToCells,
  type ReconciliationRow,
} from '../services/schema.js'

/**
 * Day-1 go-live tool (npm run graph:check).
 *
 * GRAPH_MODE=mock -> prints the skip line.
 * GRAPH_MODE=live -> authenticates, locates the workbook, bootstraps tables,
 * appends a test row, reads it back, deletes it, and prints PASS/FAIL per step.
 */

interface StepResult {
  name: string
  pass: boolean
  detail: string
}

async function runLiveChecks(): Promise<StepResult[]> {
  const results: StepResult[] = []
  const env = readGraphEnv()
  const storage = new GraphStorage(env)

  // Step 1: authenticate (app-only token via MSAL client credentials).
  try {
    const token = await storage.authenticate()
    results.push({
      name: 'AUTH (client credentials token)',
      pass: token.length > 0,
      detail: `token acquired (${token.length} chars)`,
    })
  } catch (error) {
    results.push({ name: 'AUTH (client credentials token)', pass: false, detail: (error as Error).message })
    return results
  }

  // Step 2: locate the workbook by drive/item id.
  try {
    const name = await storage.workbookName()
    results.push({ name: 'LOCATE workbook (drive/item id)', pass: true, detail: name })
  } catch (error) {
    results.push({
      name: 'LOCATE workbook (drive/item id)',
      pass: false,
      detail: (error as Error).message,
    })
    return results
  }

  // Step 3: bootstrap sheets + tables (idempotent).
  try {
    await storage.ensureWorkbook()
    results.push({ name: 'BOOTSTRAP sheets + tables', pass: true, detail: 'ensured' })
  } catch (error) {
    results.push({ name: 'BOOTSTRAP sheets + tables', pass: false, detail: (error as Error).message })
    return results
  }

  // Steps 4-6: append a test row, read it back, delete it.
  const marker = `GRAPH-CHECK ${new Date().toISOString()}`
  const testRow: ReconciliationRow = {
    Date: '1900-01-01',
    Location: 'GraphCheck',
    SKU_Code: 'GRAPHCHECK-TEST',
    Item_Name: marker,
    LeverEdge_Qty: 1,
    Xero_Qty: 1,
    Physical_CS: null,
    Physical_DZ: null,
    Physical_PC: 1,
    Physical_Units: 1,
    Docked_Qty: 0,
    Undocked_Qty: 0,
    Total_Variance: 0,
    Unit_Price_NGN: 1,
    Variance_Value_NGN: 0,
    Shortage_Qty: 0,
    Surplus_Qty: 0,
    Sellable_Forward_Qty: 0,
    Status: 'Matched',
    Needs_Review: false,
    Manager_ID: 'graph-check',
    Submitted_At: new Date().toISOString(),
    Notes: marker,
  }

  try {
    await storage.appendRows(RECONCILIATION_SHEET, [reconRowToCells(testRow)])
    results.push({ name: 'APPEND test row', pass: true, detail: marker })
  } catch (error) {
    results.push({ name: 'APPEND test row', pass: false, detail: (error as Error).message })
    await storage.closeSession()
    return results
  }

  try {
    const rows = await storage.readTable(RECONCILIATION_SHEET)
    const found = rows.some((row) => String(row.Item_Name) === marker)
    results.push({
      name: 'READ BACK test row',
      pass: found,
      detail: found ? 'found by marker' : 'marker row not found in ReconTable',
    })
  } catch (error) {
    results.push({ name: 'READ BACK test row', pass: false, detail: (error as Error).message })
  }

  try {
    const removed = await storage.deleteRows(
      RECONCILIATION_SHEET,
      (row) => String(row.Item_Name) === marker
    )
    const rows = await storage.readTable(RECONCILIATION_SHEET)
    const stillThere = rows.some((row) => String(row.Item_Name) === marker)
    results.push({
      name: 'DELETE test row',
      pass: removed === 1 && !stillThere,
      detail: `removed=${removed}, stillPresent=${stillThere}`,
    })
  } catch (error) {
    results.push({ name: 'DELETE test row', pass: false, detail: (error as Error).message })
  }

  await storage.closeSession()
  return results
}

async function main(): Promise<void> {
  console.log(`graph:check — ${lagosDateString(new Date())} (Africa/Lagos)\n`)

  const mode = currentGraphMode()
  if (mode !== 'live') {
    console.log('mock mode — graph check skipped')
    return
  }

  const missing = missingGraphEnvVars(readGraphEnv())
  if (missing.length > 0) {
    console.log('FAIL: GRAPH_MODE=live but these env vars are blank:')
    for (const name of missing) console.log(`  - ${name}`)
    console.log('Set them or run with GRAPH_MODE=mock.')
    process.exitCode = 1
    return
  }

  const results = await runLiveChecks()
  let failed = false
  for (const result of results) {
    if (!result.pass) failed = true
    console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`)
  }
  console.log()
  console.log(failed ? 'RESULT: FAIL (see steps above)' : 'RESULT: PASS — Graph live mode is good to go')
  if (failed) process.exitCode = 1
}

void main()
