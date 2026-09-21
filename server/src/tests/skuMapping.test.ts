import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'

/**
 * SKU mapping store + admin API tests. These run against a TEMPORARY copy of
 * the seed CSV so the real samples/sku_seed.csv is never mutated. Env vars are
 * set before dynamically importing the app so config picks them up.
 */

const tempDir = mkdtempSync(join(tmpdir(), 'renuzi-sku-seed-'))
const seedPath = join(tempDir, 'sku_seed.csv')

const SEED_CSV = [
  'LeverEdge_SKU_Code,LeverEdge_Item_Name,Xero_Item_Code,Xero_Item_Name,CS_Factor,DZ_Factor,Category,Active',
  'L1,LUX BAR ONE,X1,LUX BAR UNO,24,12,Soap,true',
  '',
].join('\n')

let store: typeof import('../services/skuMappingStore.js')
let app: import('express').Express
let adminToken: string
let managerToken: string

beforeAll(async () => {
  writeFileSync(seedPath, SEED_CSV, 'utf-8')
  process.env.SKU_SEED_PATH = seedPath
  process.env.CUTOFF_HOUR = '24' // never locked — route tests must be time-independent
  store = await import('../services/skuMappingStore.js')
  const { createApp } = await import('../app.js')
  app = createApp()

  const login = async (email: string, password: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password })
    return res.body.token as string
  }
  adminToken = await login('admin@renuzi', 'Admin@2026')
  managerToken = await login('ketu@renuzi', 'Ketu@2026')
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('CSV round-trip', () => {
  it('parses quoted fields, escaped quotes and CRLF line endings', () => {
    const rows = store.parseCsv('a,"b,1","c""d"\r\n"e"\r\n')
    expect(rows).toEqual([['a', 'b,1', 'c"d'], ['e']])
  })

  it('serializes entries with commas and quotes safely', () => {
    const csv = store.stringifyCsv([
      ['L1', 'LUX, "ONE"', 'X1', 'LUX "UNO"', '24', '12', 'Soap', 'true'],
    ])
    expect(store.parseCsv(csv)).toEqual([
      ['L1', 'LUX, "ONE"', 'X1', 'LUX "UNO"', '24', '12', 'Soap', 'true'],
    ])
  })
})

describe('sku mapping store', () => {
  it('loads the seed with parsed factors and flags', () => {
    const mappings = store.listSkuMappings(seedPath)
    expect(mappings).toHaveLength(1)
    expect(mappings[0]).toEqual({
      leverEdgeSkuCode: 'L1',
      leverEdgeItemName: 'LUX BAR ONE',
      xeroItemCode: 'X1',
      xeroItemName: 'LUX BAR UNO',
      csFactor: 24,
      dzFactor: 12,
      category: 'Soap',
      active: true,
    })
  })

  it('creates entries and persists them back to disk', () => {
    const result = store.createSkuMapping(
      { leverEdgeSkuCode: 'L2', leverEdgeItemName: 'LUX BAR TWO', active: false },
      seedPath
    )
    expect(result.ok).toBe(true)
    const onDisk = readFileSync(seedPath, 'utf-8')
    expect(onDisk).toContain('L2,LUX BAR TWO,,,1,12,,false')
    expect(store.listSkuMappings(seedPath)).toHaveLength(2)
  })

  it('rejects duplicates and invalid payloads', () => {
    expect(store.createSkuMapping({ leverEdgeSkuCode: 'L1' }, seedPath)).toEqual({
      ok: false,
      error: 'SKU_MAPPING_EXISTS',
    })
    expect(store.createSkuMapping({ leverEdgeItemName: 'no code' }, seedPath)).toEqual({
      ok: false,
      error: 'INVALID_SKU_MAPPING',
    })
    expect(store.createSkuMapping(null, seedPath)).toEqual({
      ok: false,
      error: 'INVALID_SKU_MAPPING',
    })
  })

  it('updates entries, keeping unspecified fields', () => {
    const result = store.updateSkuMapping('L2', { csFactor: 48, category: 'Bar' }, seedPath)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entry).toMatchObject({ csFactor: 48, category: 'Bar', active: false })
    }
    expect(store.updateSkuMapping('NOPE', { csFactor: 1 }, seedPath)).toEqual({
      ok: false,
      error: 'SKU_MAPPING_NOT_FOUND',
    })
  })

  it('deletes entries and persists the removal', () => {
    expect(store.deleteSkuMapping('L2', seedPath).ok).toBe(true)
    expect(store.deleteSkuMapping('L2', seedPath)).toEqual({
      ok: false,
      error: 'SKU_MAPPING_NOT_FOUND',
    })
    expect(store.listSkuMappings(seedPath)).toHaveLength(1)
  })
})

describe('admin SKU mapping API', () => {
  it('GET /api/v1/admin/sku-mapping lists entries (admin only)', async () => {
    const ok = await request(app)
      .get('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(ok.status).toBe(200)
    expect(ok.body.mappings).toHaveLength(1)

    const forbidden = await request(app)
      .get('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${managerToken}`)
    expect(forbidden.status).toBe(403)

    const anonymous = await request(app).get('/api/v1/admin/sku-mapping')
    expect(anonymous.status).toBe(401)
  })

  it('POST creates a mapping (201) and rejects duplicates (409)', async () => {
    const created = await request(app)
      .post('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leverEdgeSkuCode: 'L9', leverEdgeItemName: 'NINE', dzFactor: 6 })
    expect(created.status).toBe(201)
    expect(created.body.mapping).toMatchObject({ leverEdgeSkuCode: 'L9', dzFactor: 6, csFactor: 1 })

    const duplicate = await request(app)
      .post('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leverEdgeSkuCode: 'L9' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body).toEqual({ error: 'SKU_MAPPING_EXISTS' })

    const invalid = await request(app)
      .post('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leverEdgeItemName: 'missing code' })
    expect(invalid.status).toBe(400)
  })

  it('PUT updates and DELETE removes, persisting to the CSV seed', async () => {
    const updated = await request(app)
      .put('/api/v1/admin/sku-mapping/L9')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csFactor: 36, active: false })
    expect(updated.status).toBe(200)
    expect(updated.body.mapping).toMatchObject({ csFactor: 36, active: false })

    const missing = await request(app)
      .put('/api/v1/admin/sku-mapping/GHOST')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csFactor: 2 })
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({ error: 'SKU_MAPPING_NOT_FOUND' })

    const removed = await request(app)
      .delete('/api/v1/admin/sku-mapping/L9')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(removed.status).toBe(200)
    expect(removed.body.mapping.leverEdgeSkuCode).toBe('L9')

    const listed = await request(app)
      .get('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(
      listed.body.mappings.map((m: { leverEdgeSkuCode: string }) => m.leverEdgeSkuCode)
    ).toEqual(['L1'])
  })

  it('blocks writes for non-admins even before validation', async () => {
    const forbidden = await request(app)
      .post('/api/v1/admin/sku-mapping')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ leverEdgeSkuCode: 'L8' })
    expect(forbidden.status).toBe(403)
  })
})
