import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MockStorage,
  QueuedStorage,
  WriteQueue,
  errorWithStatus,
  withRetry,
} from '../services/storage/index.js'
import { AUDITLOG_SHEET, RECONCILIATION_SHEET } from '../services/schema.js'

/**
 * Phase 3 write-queue tests: strict serialization of every storage mutation
 * and 429/503 retry with exponential backoff.
 */

const tempDir = mkdtempSync(join(tmpdir(), 'renuzi-writequeue-'))
let workbookPath: string

beforeAll(() => {
  workbookPath = join(tempDir, 'master_workbook.xlsx')
  process.env.MASTER_WORKBOOK_PATH = workbookPath
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('withRetry', () => {
  it('retries retryable errors (429/503) and succeeds on a later attempt', async () => {
    const delays: number[] = []
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts += 1
        if (attempts < 3) throw errorWithStatus(429, 'throttled')
        return 'ok'
      },
      { baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) }
    )
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
    expect(delays).toEqual([100, 200]) // exponential backoff
  })

  it('gives up after maxTries (4) attempts on persistent 503', async () => {
    const delays: number[] = []
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw errorWithStatus(503, 'unavailable')
        },
        { sleep: async (ms) => void delays.push(ms) }
      )
    ).rejects.toThrow('unavailable')
    expect(attempts).toBe(4)
    expect(delays).toEqual([500, 1000, 2000])
  })

  it('does not retry non-retryable errors', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw errorWithStatus(400, 'bad request')
        },
        { sleep: async () => void 0 }
      )
    ).rejects.toThrow('bad request')
    expect(attempts).toBe(1)
  })

  it('honours a Retry-After hint over the computed backoff', async () => {
    const delays: number[] = []
    let attempts = 0
    await withRetry(
      async () => {
        attempts += 1
        if (attempts === 1) throw errorWithStatus(429, 'throttled', 1234)
        return 42
      },
      { baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) }
    )
    expect(delays).toEqual([1234])
  })
})

describe('WriteQueue', () => {
  it('runs queued operations strictly sequentially in submission order', async () => {
    const queue = new WriteQueue()
    const events: string[] = []
    let active = 0
    let maxActive = 0

    const operation = (id: number, durationMs: number) =>
      queue.enqueue(async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, durationMs))
        events.push(`done-${id}`)
        active -= 1
      })

    // Fire out-of-order durations: if runs interleaved, order would scramble.
    const pending = [operation(1, 30), operation(2, 5), operation(3, 20), operation(4, 1)]
    await Promise.all(pending)
    expect(events).toEqual(['done-1', 'done-2', 'done-3', 'done-4'])
    expect(maxActive).toBe(1)
  })

  it('keeps processing later operations after a failed one', async () => {
    const queue = new WriteQueue()
    const events: string[] = []
    const failing = queue.enqueue(async () => {
      throw new Error('boom')
    })
    const succeeding = queue.enqueue(async () => {
      events.push('after-failure')
    })
    await expect(failing).rejects.toThrow('boom')
    await succeeding
    expect(events).toEqual(['after-failure'])
  })
})

describe('QueuedStorage + MockStorage integration', () => {
  it('10 concurrent appends land in strict submission order (no interleaving)', async () => {
    const storage = new QueuedStorage(new MockStorage(workbookPath))
    await storage.ensureWorkbook()

    const skus = Array.from({ length: 10 }, (_, i) => `ORD-${String(i).padStart(2, '0')}`)
    await Promise.all(
      skus.map((sku) =>
        storage.appendRows(RECONCILIATION_SHEET, [
          [
            '2026-09-22', // Date
            'Ketu', // Location
            sku, // SKU_Code
            `row ${sku}`, // Item_Name
            ...Array<null>(19).fill(null),
          ],
        ])
      )
    )

    const rows = await storage.readTable(RECONCILIATION_SHEET)
    expect(rows).toHaveLength(10)
    expect(rows.map((row) => row.SKU_Code)).toEqual(skus)
  })

  it('runs a transaction exclusively: concurrent appends never interleave inside it', async () => {
    const storage = new QueuedStorage(new MockStorage(workbookPath))
    await storage.ensureWorkbook()

    const order: string[] = []
    const transaction = storage.runExclusive(async () => {
      order.push('txn-start')
      await storage.appendRows(AUDITLOG_SHEET, [
        ['2026-01-01T00:00:00Z', 'tester', 't@renuzi', 'GRAPH_CHECK', null, null, 'in-txn'],
      ])
      order.push('txn-end')
    })
    const append = storage
      .appendRows(AUDITLOG_SHEET, [
        ['2026-01-01T00:00:01Z', 'tester', 't@renuzi', 'GRAPH_CHECK', null, null, 'outside-txn'],
      ])
      .then(() => order.push('append-done'))

    await Promise.all([transaction, append])
    // The queued append must not run between the transaction's own steps.
    expect(order.indexOf('append-done')).toBeGreaterThan(order.indexOf('txn-end'))

    const audit = await storage.readTable(AUDITLOG_SHEET)
    expect(audit.map((row) => row.Details)).toEqual(['in-txn', 'outside-txn'])
  })
})
