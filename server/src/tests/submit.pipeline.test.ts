import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'

/**
 * Phase 3 submit pipeline, end to end in mock mode:
 *  - POST /api/v1/reconciliation/submit with the /samples exports + manual counts
 *  - rows land in the workbook's ReconTable, entries in AuditLog
 *  - resubmitting the same date+location replaces rows (no duplicates)
 *  - GET /status, GET /admin/audit, GET /health
 *  - fail-fast guard: GRAPH_MODE=live without AZURE_* credentials
 *
 * Everything runs against a TEMPORARY workbook so the real
 * server/data/master_workbook.xlsx is never touched.
 */

const SAMPLES = fileURLToPath(new URL('../../../samples/', import.meta.url))
const tempDir = mkdtempSync(join(tmpdir(), 'renuzi-submit-'))
const workbookPath = join(tempDir, 'master_workbook.xlsx')

let app: import('express').Express
let ketuToken: string
let adminToken: string
let today: string
let storage: typeof import('../services/storage/index.js')
let schema: typeof import('../services/schema.js')

function countsPayload(date: string, location: string): string {
  return JSON.stringify({
    date,
    location,
    notes: 'daily submission',
    rows: [
      // Manual recount of a SKU that exists in the physical sample file.
      { sku: '21033927', cs: 2, dz: 0, pc: 5, notes: 'manual recount' },
      // A SKU only present in the manual counts (not in any export).
      { sku: 'TEST-NEW-1', cs: 1, dz: 1, pc: 1, notes: null },
    ],
  })
}

function submitRequest(token: string, date: string, location = 'Ketu') {
  return request(app)
    .post('/api/v1/reconciliation/submit')
    .set('Authorization', `Bearer ${token}`)
    .field('counts', countsPayload(date, location))
    .attach('leveredge', readFileSync(join(SAMPLES, 'leveredge_sample.xlsx')), {
      filename: 'leveredge_sample.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    .attach('xero', readFileSync(join(SAMPLES, 'xero_sample.xlsx')), {
      filename: 'xero_sample.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    .attach('physical', readFileSync(join(SAMPLES, 'physical_sample.xlsx')), {
      filename: 'physical_sample.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
}

beforeAll(async () => {
  process.env.MASTER_WORKBOOK_PATH = workbookPath
  process.env.SKU_SEED_PATH = join(SAMPLES, 'sku_seed.csv')
  process.env.CUTOFF_HOUR = '24' // never locked — tests must be time-independent
  process.env.GRAPH_MODE = 'mock'

  storage = await import('../services/storage/index.js')
  schema = await import('../services/schema.js')
  const { lagosDateString } = await import('../services/cutoff.js')
  const { createApp } = await import('../app.js')
  app = createApp()
  today = lagosDateString(new Date())

  const login = async (email: string, password: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password })
    return res.body.token as string
  }
  ketuToken = await login('ketu@renuzi', 'Ketu@2026')
  adminToken = await login('admin@renuzi', 'Admin@2026')
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('POST /api/v1/reconciliation/submit (mock happy path)', () => {
  it('requires both export files', async () => {
    const res = await request(app)
      .post('/api/v1/reconciliation/submit')
      .set('Authorization', `Bearer ${ketuToken}`)
      .field('counts', countsPayload(today, 'Ketu'))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('MISSING_FILES')
  })

  it('forbids managers from submitting for another location', async () => {
    const res = await submitRequest(ketuToken, today, 'Lekki')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('LOCATION_FORBIDDEN')
  })

  it('parses the samples, reconciles and returns a summary', async () => {
    const res = await submitRequest(ketuToken, today)
    expect(res.status).toBe(200)
    expect(res.body.date).toBe(today)
    expect(res.body.location).toBe('Ketu')
    expect(res.body.replacedRows).toBe(0)

    expect(res.body.parsed).toMatchObject({
      leveredge: 91,
      physical: 310,
      manualCounts: 2,
    })
    expect(res.body.parsed.xero).toBeGreaterThan(0)
    expect(res.body.parsed.xero).toBeLessThanOrEqual(136)

    const summary = res.body.summary
    expect(summary.rowCount).toBeGreaterThan(0)
    expect(summary.matched + summary.discrepancy + summary.unmapped).toBe(summary.rowCount)
    for (const key of [
      'dockedQty',
      'dockedValueNGN',
      'undockedQty',
      'undockedValueNGN',
      'totalVarianceValueNGN',
      'atRiskSkus',
      'needsReview',
    ]) {
      expect(summary).toHaveProperty(key)
    }
  })

  it('writes ReconTable rows (incl. manual counts) to the workbook', async () => {
    expect(existsSync(workbookPath)).toBe(true)
    const rows = await storage.getStorage().readTable(schema.RECONCILIATION_SHEET)
    const scoped = rows.filter((row) => String(row.Date) === today && String(row.Location) === 'Ketu')
    expect(scoped.length).toBeGreaterThan(0)

    const recounted = scoped.find((row) => String(row.SKU_Code) === '21033927')
    expect(recounted).toBeDefined()
    expect(recounted?.Physical_CS).toBe(2)
    expect(recounted?.Physical_DZ).toBe(0)
    expect(recounted?.Physical_PC).toBe(5)
    expect(String(recounted?.Notes)).toContain('Manual: manual recount')

    const manualOnly = scoped.find((row) => String(row.SKU_Code) === 'TEST-NEW-1')
    expect(manualOnly).toBeDefined()
    expect(manualOnly?.Physical_Units).toBeGreaterThan(0)
  })

  it('writes a SUBMIT_RECONCILIATION entry to AuditLog', async () => {
    const audit = await storage.getStorage().readTable(schema.AUDITLOG_SHEET)
    const entries = audit.filter((row) => row.Action === 'SUBMIT_RECONCILIATION')
    expect(entries).toHaveLength(1)
    expect(entries[0].Actor_ID).toBe('usr_ketu')
    expect(entries[0].Date).toBe(today)
    expect(entries[0].Location).toBe('Ketu')
  })
})

describe('idempotent resubmit', () => {
  it('replaces rows for the same date+location without duplicating', async () => {
    const first = await submitRequest(ketuToken, today)
    expect(first.status).toBe(200)
    const firstCount = first.body.summary.rowCount as number

    const second = await submitRequest(ketuToken, today)
    expect(second.status).toBe(200)
    expect(second.body.replacedRows).toBe(firstCount)
    expect(second.body.summary.rowCount).toBe(firstCount)

    const rows = await storage.getStorage().readTable(schema.RECONCILIATION_SHEET)
    const scoped = rows.filter((row) => String(row.Date) === today && String(row.Location) === 'Ketu')
    // One submit's worth of rows — the resubmit replaced, not accumulated.
    // (The engine may legitimately emit several groups for one SKU code when
    // unmapped Xero/LeverEdge items share a code but not a name, so row count
    // — not distinct-SKU count — is the idempotency invariant.)
    expect(scoped).toHaveLength(firstCount)

    const audit = await storage.getStorage().readTable(schema.AUDITLOG_SHEET)
    // happy-path submit + the two in this test
    expect(audit.filter((row) => row.Action === 'SUBMIT_RECONCILIATION')).toHaveLength(3)
  })
})

describe('GET /api/v1/reconciliation/status', () => {
  it('returns the submitted rows and lock state for the manager', async () => {
    const res = await request(app)
      .get('/api/v1/reconciliation/status')
      .query({ date: today, location: 'Ketu' })
      .set('Authorization', `Bearer ${ketuToken}`)
    expect(res.status).toBe(200)
    expect(res.body.locked).toBe(false)
    expect(res.body.rowCount).toBeGreaterThan(0)
    expect(res.body.rows[0]).toMatchObject({ Date: today, Location: 'Ketu' })
    expect(res.body.summary.rowCount).toBe(res.body.rowCount)
  })

  it('rejects managers querying another location', async () => {
    const res = await request(app)
      .get('/api/v1/reconciliation/status')
      .query({ date: today, location: 'Lekki' })
      .set('Authorization', `Bearer ${ketuToken}`)
    expect(res.status).toBe(403)
  })

  it('validates date and location params', async () => {
    const res = await request(app)
      .get('/api/v1/reconciliation/status')
      .query({ location: 'Ketu' })
      .set('Authorization', `Bearer ${ketuToken}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/admin/audit + /api/v1/health', () => {
  it('lists audit entries for admins, blocks managers', async () => {
    const ok = await request(app)
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(ok.status).toBe(200)
    expect(ok.body.count).toBeGreaterThanOrEqual(2)
    expect(
      ok.body.entries.some(
        (entry: { Action?: string }) => entry.Action === 'SUBMIT_RECONCILIATION'
      )
    ).toBe(true)

    const forbidden = await request(app)
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${ketuToken}`)
    expect(forbidden.status).toBe(403)
  })

  it('health reports the mock storage mode', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', storageMode: 'mock' })
  })
})

describe('fail-fast guard: GRAPH_MODE=live without credentials', () => {
  it('rejects storage initialization with a clear error naming the blank vars', async () => {
    storage.resetStorage()
    process.env.GRAPH_MODE = 'live'
    for (const name of ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'GRAPH_DRIVE_ID', 'GRAPH_FILE_ITEM_ID']) {
      process.env[name] = ''
    }
    try {
      expect(() => storage.getStorage()).toThrow(/AZURE_TENANT_ID/)
      expect(() => storage.getStorage()).toThrow(/GRAPH_MODE=live/)
      await expect(storage.storageReady()).rejects.toThrow(/AZURE_CLIENT_SECRET/)
    } finally {
      process.env.GRAPH_MODE = 'mock'
      storage.resetStorage()
    }
  })
})
