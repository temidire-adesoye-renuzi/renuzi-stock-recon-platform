import { masterWorkbookPath, SKU_SEED_PATH } from '../../config.js'
import { loadSkuMapping } from '../skuMappingStore.js'
import {
  SKUMAP_SHEET,
  skuEntryToCells,
  type AuditLogEntry,
  type WorkbookTableRow,
} from '../schema.js'
import { GraphStorage, type GraphStorageConfig } from './graphStorage.js'
import { MockStorage } from './mockStorage.js'
import { QueuedStorage } from './queuedStorage.js'
import type { IStorage } from './types.js'

/**
 * Storage factory. GRAPH_MODE=mock (default) -> local ExcelJS workbook;
 * GRAPH_MODE=live -> Microsoft Graph. Callers depend only on IStorage, so
 * switching modes is a pure env-var change with zero code edits.
 */

export type StorageMode = 'mock' | 'live'

export interface GraphEnv {
  tenantId: string
  clientId: string
  clientSecret: string
  driveId: string
  fileItemId: string
}

export const GRAPH_ENV_VARS: Record<keyof GraphEnv, string> = {
  tenantId: 'AZURE_TENANT_ID',
  clientId: 'AZURE_CLIENT_ID',
  clientSecret: 'AZURE_CLIENT_SECRET',
  driveId: 'GRAPH_DRIVE_ID',
  fileItemId: 'GRAPH_FILE_ITEM_ID',
}

/** Raw env read (may contain blanks). */
export function readGraphEnv(): GraphEnv {
  return {
    tenantId: (process.env.AZURE_TENANT_ID ?? '').trim(),
    clientId: (process.env.AZURE_CLIENT_ID ?? '').trim(),
    clientSecret: (process.env.AZURE_CLIENT_SECRET ?? '').trim(),
    driveId: (process.env.GRAPH_DRIVE_ID ?? '').trim(),
    fileItemId: (process.env.GRAPH_FILE_ITEM_ID ?? '').trim(),
  }
}

export function missingGraphEnvVars(env: GraphEnv): string[] {
  return (Object.keys(GRAPH_ENV_VARS) as Array<keyof GraphEnv>)
    .filter((key) => env[key] === '')
    .map((key) => GRAPH_ENV_VARS[key])
}

/** Validated mode; throws a descriptive error for unknown values. */
export function currentGraphMode(): StorageMode {
  const raw = (process.env.GRAPH_MODE ?? 'mock').trim().toLowerCase()
  if (raw === 'mock' || raw === 'live') return raw
  throw new Error(
    `GRAPH_MODE must be "mock" or "live" (got "${raw}"). Fix the environment and restart.`
  )
}

/** Never throws — for health reporting. */
export function reportedGraphMode(): string {
  try {
    return currentGraphMode()
  } catch {
    return 'invalid'
  }
}

let storage: IStorage | null = null

/** Get the process-wide storage instance (queue-wrapped). */
export function getStorage(): IStorage {
  if (storage) return storage
  const mode = currentGraphMode()
  if (mode === 'live') {
    const env = readGraphEnv()
    const missing = missingGraphEnvVars(env)
    if (missing.length > 0) {
      throw new Error(
        `GRAPH_MODE=live but required environment variables are blank: ${missing.join(', ')}. ` +
          'Set them (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, GRAPH_DRIVE_ID, ' +
          'GRAPH_FILE_ITEM_ID) or use GRAPH_MODE=mock.'
      )
    }
    const config: GraphStorageConfig = env
    storage = new QueuedStorage(new GraphStorage(config))
  } else {
    storage = new QueuedStorage(new MockStorage(masterWorkbookPath()))
  }
  return storage
}

/** Test helper: drop the cached instance so the next getStorage() re-reads env. */
export function resetStorage(): void {
  storage = null
  readyPromise = null
}

async function migrateSkuSeedIfNeeded(storage: IStorage): Promise<void> {
  const existing = await storage.readTable(SKUMAP_SHEET)
  if (existing.length > 0) return
  const seed = loadSkuMapping(SKU_SEED_PATH)
  if (seed.length === 0) return
  await storage.appendRows(
    SKUMAP_SHEET,
    seed.map(skuEntryToCells)
  )
  const migration: AuditLogEntry = {
    Timestamp: new Date().toISOString(),
    Actor_ID: 'system',
    Actor_Email: 'system@renuzi',
    Action: 'MIGRATE_SKU_SEED',
    Date: null,
    Location: null,
    Details: `Migrated ${seed.length} SKU mapping entries from the CSV seed to the SkuMap table`,
  }
  await storage.logAudit(migration)
}

let readyPromise: Promise<void> | null = null

/**
 * Idempotent bootstrap: create/repair the workbook and (once) migrate the CSV
 * SKU seed into the SkuMap table. Memoized for the process lifetime.
 */
export function storageReady(): Promise<void> {
  readyPromise ??= (async () => {
    const instance = getStorage()
    await instance.ensureWorkbook()
    await migrateSkuSeedIfNeeded(instance)
  })()
  return readyPromise
}

/**
 * Run a multi-step storage sequence (delete + append + audit, ...) as ONE
 * step in the global write queue so concurrent requests cannot interleave it.
 */
export function storageTransaction<T>(operation: () => Promise<T>): Promise<T> {
  const instance = getStorage()
  if (instance instanceof QueuedStorage) return instance.runExclusive(operation)
  return operation()
}

export type { IStorage }
export type { WorkbookTableRow }
