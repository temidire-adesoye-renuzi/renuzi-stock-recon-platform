/* Runtime smoke test of the client libs + mockApi against the real /samples files. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- localStorage shim (mockApi persists here) ---
const backing = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
  setItem: (key: string, value: string) => backing.set(key, String(value)),
  removeItem: (key: string) => backing.delete(key),
  clear: () => backing.clear(),
}

const { mockApi } = await import('./client/src/lib/mockApi')
const { parseLeverEdgeFile, parseXeroFile, parsePhysicalFile } = await import(
  './client/src/lib/xlsx'
)
const { buildPreviewRows, computePreviewRow, summarizePreview } = await import(
  './client/src/lib/recon'
)
const { isSubmissionOpen, lagosDateString, secondsUntilCutoff } = await import(
  './client/src/lib/wat'
)

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`ok: ${message}`)
  }
}

function fakeFile(path: string): File {
  const buffer = readFileSync(resolve(path))
  return {
    name: path.split(/[\\/]/).pop()!,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    text: async () => buffer.toString('utf-8'),
  } as unknown as File
}

// --- wat sanity ---
const today = lagosDateString()
console.log(`today(Lagos)=${today} cutoffSeconds=${secondsUntilCutoff()}`)
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), 'lagosDateString returns YYYY-MM-DD')
assert(isSubmissionOpen(today) === secondsUntilCutoff() > 0, 'cutoff helpers agree')

// --- login ---
function setSession(token: string): void {
  ;(globalThis as Record<string, unknown>).localStorage.setItem('renuzi_token', token)
}
const admin = await mockApi.login('admin@renuzi', 'anything')
setSession(admin.token)
assert(admin.user.role === 'admin' && admin.token === 'mock.usr_admin', 'admin login (any password)')
let failed = false
try {
  await mockApi.login('nobody@renuzi', 'x')
} catch {
  failed = true
}
assert(failed, 'unknown email rejected with 401')

// --- parse the real samples ---
const leveredge = await parseLeverEdgeFile(fakeFile('samples/leveredge_sample.xlsx'))
assert(leveredge.rows.length > 50, `leveredge parsed (${leveredge.rows.length} rows)`)
assert(leveredge.rows.every((row) => typeof row.sku === 'string'), 'SKUs survive as strings')
const xero = await parseXeroFile(fakeFile('samples/xero_sample.xlsx'))
assert(xero.rows.length > 50, `xero parsed (${xero.rows.length} rows)`)
assert(xero.sheetNames.some((name) => /KETU/i.test(name)), 'xero sheet names carry locations')
const physical = await parsePhysicalFile(fakeFile('samples/physical_sample.xlsx'))
assert(physical.rows.length > 100, `physical parsed (${physical.rows.length} rows)`)

// --- validation rejection ---
const bad = fakeFile('samples/sku_seed.csv')
let rejected = false
try {
  await parseLeverEdgeFile(bad)
} catch (error) {
  rejected = (error as { issues?: string[] }).issues !== undefined
}
assert(rejected, 'wrong file rejected with column-level issues')

// --- mappings + preview join ---
const mappings = await mockApi.listMappings()
assert(mappings.length >= 30, `mappings seeded (${mappings.length})`)
const xeroKetu = xero.rows.filter((row) => row.location === 'Ketu')
const preview = buildPreviewRows(
  { leveredge: leveredge.rows, xero: xeroKetu, physical: [] },
  mappings,
)
assert(preview.length > 30, `preview rows joined (${preview.length})`)
const computedRows = preview.map(computePreviewRow)
const summarized = summarizePreview(computedRows)
console.log('preview summary', summarized)
assert(summarized.atRiskSkus > 0, 'preview flags at-risk SKUs')
const bigVariance = computedRows.filter((row) => row.noteRequired)
console.log(`note-required rows: ${bigVariance.length}`)

// --- submit as Ketu manager with the samples ---
const ketu = await mockApi.login('ketu@renuzi', 'demo')
setSession(ketu.token)
const result = await mockApi.submitReconciliation({
  leveredge: fakeFile('samples/leveredge_sample.xlsx'),
  xero: fakeFile('samples/xero_sample.xlsx'),
  physical: fakeFile('samples/physical_sample.xlsx'),
  counts: {
    date: today,
    location: 'Ketu',
    rows: computedRows.map((row) => ({
      sku: row.sku,
      cs: row.cs,
      dz: row.dz,
      pc: row.pc,
      notes: row.noteRequired ? 'Short-supply confirmed with loading bay' : null,
    })),
  },
})
console.log('submit summary', result.summary)
assert(result.summary.rowCount > 30, `submit reconciled ${result.summary.rowCount} rows`)
assert(result.parsed.leveredge === leveredge.rows.length, 'submit parsed leveredge count matches')

// status reflects the submission
const status = await mockApi.getReconciliationStatus(today, 'Ketu')
assert(status.rowCount === result.summary.rowCount, 'status rows match submit')
assert(status.summary.discrepancy > 0, 'status contains Discrepancies')

// seeded history has a healthy mix (Matched / Discrepancy) for the dashboard
const seededDate = new Date(Date.now() - 3 * 86_400_000)
const seeded = await mockApi.getReconciliationStatus(
  seededDate.toISOString().slice(0, 10),
  'Ketu',
)
assert(
  seeded.summary.matched > 0 && seeded.summary.discrepancy > 0,
  `seeded history mixes Matched (${seeded.summary.matched}) + Discrepancy (${seeded.summary.discrepancy})`,
)

// unmapped queue picked up unmapped SKUs
const unmapped = await mockApi.listUnmappedSkus()
assert(unmapped.length > 0, `unmapped queue populated (${unmapped.length})`)

// manager scoping
failed = false
try {
  await mockApi.getReconciliationStatus(today, 'Lekki')
} catch (error) {
  failed = (error as { code?: string }).code === 'LOCATION_FORBIDDEN'
}
assert(failed, 'manager cannot read another location')

// mapping CRUD as admin
setSession(admin.token)
const created = await mockApi.createMapping({
  leverEdgeSkuCode: '99990001',
  leverEdgeItemName: 'SMOKE TEST SKU',
  xeroItemCode: '99990001',
  xeroItemName: 'Smoke Test SKU',
  csFactor: 12,
  dzFactor: 12,
  category: 'Test',
  active: true,
})
assert(created.leverEdgeSkuCode === '99990001', 'mapping created')
const updated = await mockApi.updateMapping('99990001', { category: 'Smoke' })
assert(updated.category === 'Smoke', 'mapping inline-updated')
await mockApi.deleteMapping('99990001')
assert(!(await mockApi.listMappings()).some((entry) => entry.leverEdgeSkuCode === '99990001'), 'mapping deleted')

// CSV import (use the real seed CSV headers + one row)
const csv = 'LeverEdge_SKU_Code,LeverEdge_Item_Name,Xero_Item_Code,Xero_Item_Name,CS_Factor,DZ_Factor,Category,Active\n99990002,SMOKE CSV SKU,99990002,Smoke CSV,24,12,Test,true\n'
const imported = await mockApi.importMappings({
  name: 'smoke.csv',
  text: async () => csv,
  arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
} as unknown as File)
assert(imported.created === 1, 'CSV import created 1')
await mockApi.deleteMapping('99990002')

// audit (executive)
const exec = await mockApi.login('exec@renuzi', 'demo')
setSession(exec.token)
const audit = await mockApi.listAudit({ limit: 50 })
assert(
  audit.count > 0 && audit.entries.some((entry) => entry.Action === 'SUBMIT_RECONCILIATION'),
  'audit trail lists submissions',
)

// role enforcement: executive cannot write mappings
setSession(exec.token)
failed = false
try {
  await mockApi.createMapping({
    leverEdgeSkuCode: 'x',
    leverEdgeItemName: '',
    xeroItemCode: '',
    xeroItemName: '',
    csFactor: 1,
    dzFactor: 12,
    category: '',
    active: true,
  })
} catch (error) {
  failed = (error as { code?: string }).code === 'FORBIDDEN'
}
assert(failed, 'executive blocked from mapping writes')

console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED')
