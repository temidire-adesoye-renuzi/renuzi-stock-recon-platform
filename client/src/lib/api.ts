/**
 * VERIFIED BACKEND CONTRACT — read from server/src/routes/*, server/src/services/schema.ts,
 * server/src/middleware/* on 2026-09-22. Where this differs from the brief's starting
 * contract, reality wins; deviations are listed at the bottom.
 *
 * Auth (routes/auth.ts):
 *   POST /api/v1/auth/login  {email, password}
 *     → 200 {token, user:{id,email,name,role:'admin'|'executive'|'warehouse_manager',location?}}
 *     → 400 {error:'EMAIL_AND_PASSWORD_REQUIRED'} | 401 {error:'INVALID_CREDENTIALS'}
 *   GET  /api/v1/auth/me (Bearer) → {user}
 *
 * Reconciliation (routes/reconciliation.ts, Bearer; managers scoped to own location):
 *   POST /api/v1/reconciliation/submit — multipart fields: leveredge (required), xero
 *        (required), physical (optional) + counts (JSON string
 *        {date:'YYYY-MM-DD', location, rows:[{sku, cs, dz, pc, notes}], notes?});
 *        roles warehouse_manager|admin; replaces any earlier same date+location submission.
 *     → 200 {date, location, replacedRows,
 *            parsed:{leveredge,xero,physical,manualCounts},
 *            summary:{rowCount, matched, discrepancy, unmapped, needsReview, atRiskSkus,
 *                     dockedQty, dockedValueNGN, undockedQty, undockedValueNGN,
 *                     totalVarianceValueNGN}}
 *     → 400 {error:'MISSING_FILES'|'INVALID_COUNTS_*'}
 *       403 {error:'LOCATION_FORBIDDEN'|'LOCKED_FOR_AUDIT'}
 *       422 {error:'UNPARSABLE_FILE', message}
 *   GET /api/v1/reconciliation/status?date=YYYY-MM-DD&location=<name>
 *     → {date, location, locked, rowCount, summary, rows: ReconciliationRow[]}
 *
 *   ReconciliationRow uses the master-workbook PascalCase columns (schema.ts): Date, Location,
 *   SKU_Code, Item_Name, LeverEdge_Qty, Xero_Qty, Physical_CS/DZ/PC/Units, Docked_Qty,
 *   Undocked_Qty, Total_Variance, Unit_Price_NGN, Variance_Value_NGN, Shortage_Qty,
 *   Surplus_Qty, Sellable_Forward_Qty, Status:'Matched'|'Discrepancy'|'Unmapped',
 *   Needs_Review, Manager_ID, Submitted_At, Notes. null = source did not report the item.
 *   Formulas: Physical_Units = CS*csFactor + DZ*dzFactor + PC; Docked = LeverEdge−Physical;
 *   Undocked = Physical−Xero; Total_Variance = LeverEdge−Xero.
 *
 * SKU mapping (routes/skuMapping.ts under /api/v1/admin/sku-mapping, admin only):
 *   GET /            → {mappings: SkuMappingEntry[]}
 *   POST /           → 201 {mapping} | 409 {error:'SKU_MAPPING_EXISTS'} | 400 INVALID_SKU_MAPPING
 *   PUT /:code       → {mapping}   (partial merge; :code = LeverEdge SKU code)
 *   DELETE /:code    → {mapping} | 404 SKU_MAPPING_NOT_FOUND
 *   POST /import     multipart 'file' (CSV: LeverEdge_SKU_Code,LeverEdge_Item_Name,
 *                     Xero_Item_Code,Xero_Item_Name,CS_Factor,DZ_Factor,Category,Active)
 *                     → {created, updated, total, errors:[{line, reason}]}
 *   SkuMappingEntry: {leverEdgeSkuCode, leverEdgeItemName, xeroItemCode, xeroItemName,
 *                     csFactor, dzFactor, category, active}
 *
 * Audit (routes/audit.ts under /api/v1/admin/audit, executive + admin):
 *   GET /?date&location&action&limit → {count, entries:[{Timestamp, Actor_ID, Actor_Email,
 *        Action, Date, Location, Details}]}
 *
 * Users (routes/admin.ts under /api/v1/admin/users, admin only): GET → {users: AuthUser[]}
 *
 * Cutoff (middleware/cutoff.ts, services/cutoff.ts): every non-GET (except login) returns
 * 403 {error:'LOCKED_FOR_AUDIT'} unless the target date is TODAY in Africa/Lagos AND the
 * Lagos wall clock is strictly before 18:00. Any other date is permanently locked for audit.
 *
 * DEVIATIONS FROM THE STARTING CONTRACT (documented, deliberate):
 *  • POST /reconciliation/preview does NOT exist on the real server. Preview is a client-side
 *    SheetJS parse with Zod header validation (lib/xlsx.ts + lib/recon.ts); submit is the only
 *    server-side parse. Mock and live behave identically for preview.
 *  • No /locations endpoint: listLocations() returns the canonical warehouses (Ketu, Lekki)
 *    live-side; the mock also derives fresh locations from submitted rows.
 *  • listMappings() is admin-only live; the mock permits any authenticated user so the
 *    executive category slicer demos richly. Live executives get 403 → dashboard degrades to
 *    "All categories" only.
 *  • Unmapped queue + executive row flags have no real endpoints. The mock tracks SKUs that
 *    failed to map during preview/submit with Dice ≥ 0.85 suggestions (mirroring the server
 *    matcher in services/skuMatching.ts); Accept creates a mapping through the normal create
 *    call. Live returns an empty queue. Flags live in localStorage (lib/flags.ts) in both modes.
 *  • Mock auth: admin@renuzi / ketu@renuzi / lekki@renuzi accept ANY password (real passwords
 *    are Admin@2026 / Ketu@2026 / Lekki@2026); the mock adds a demo executive exec@renuzi
 *    because the real server has no executive user seeded.
 */
import type { AuthUser, RenuziApi } from './apiTypes'
import { TOKEN_KEY, USER_KEY } from './apiTypes'
import { mockApi } from './mockApi'
import { liveApi } from './liveApi'

export type { RenuziApi } from './apiTypes'
export { TOKEN_KEY, USER_KEY }
export {
  ApiError,
  type AuthUser,
  type Role,
  type ReconciliationRow,
  type ReconSummary,
  type SkuMappingEntry,
  type SkuMappingInput,
  type SkuMappingImportResult,
  type AuditEntry,
  type AuditQuery,
  type AuditListResult,
  type SubmitInput,
  type SubmitCounts,
  type ManualCountRow,
  type SubmitResult,
  type StatusResult,
  type LoginResult,
  type UnmappedSku,
} from './apiTypes'

export type ApiMode = 'mock' | 'live'

export function apiMode(): ApiMode {
  return import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
}

export function isMockMode(): boolean {
  return apiMode() === 'mock'
}

let implementation: RenuziApi | null = null

/** The RenuziApi implementation selected by VITE_API_MODE. */
export function getApi(): RenuziApi {
  if (implementation === null) {
    implementation = isMockMode() ? mockApi : liveApi
  }
  return implementation
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
