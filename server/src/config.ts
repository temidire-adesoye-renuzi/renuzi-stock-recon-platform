import 'dotenv/config'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

export const TIMEZONE = 'Africa/Lagos'

/** Folder holding the sample daily exports and the SKU mapping seed. */
export const SAMPLES_DIR = process.env.SAMPLES_DIR ?? join(REPO_ROOT, 'samples')

/** CSV seed for SKU mapping (admin writes persist here until Phase 3). */
export const SKU_SEED_PATH = process.env.SKU_SEED_PATH ?? join(SAMPLES_DIR, 'sku_seed.csv')

/** Folder for generated artifacts (dry-run reports). */
export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? join(REPO_ROOT, 'output')

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '12h'

/** WAT hour (0-23) at which submissions lock for the rest of the day. */
export const CUTOFF_HOUR = Number(process.env.CUTOFF_HOUR ?? 18)

if (JWT_SECRET === 'dev-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('JWT_SECRET is not set — using insecure development default')
}
