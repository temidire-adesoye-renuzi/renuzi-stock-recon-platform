/**
 * Shared API types mirroring the real backend shapes (server/src/services/schema.ts,
 * server/src/types.ts). Field names are PascalCase where the backend returns workbook
 * rows verbatim — do not rename; the mock and live implementations must both use these.
 */

export type Role = 'admin' | 'executive' | 'warehouse_manager'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  location?: string
}

/** services/schema.ts ReconciliationRow — one row of the master workbook. */
export interface ReconciliationRow {
  Date: string
  Location: string
  SKU_Code: string
  Item_Name: string
  LeverEdge_Qty: number | null
  Xero_Qty: number | null
  Physical_CS: number | null
  Physical_DZ: number | null
  Physical_PC: number | null
  Physical_Units: number | null
  Docked_Qty: number | null
  Undocked_Qty: number | null
  Total_Variance: number | null
  Unit_Price_NGN: number | null
  Variance_Value_NGN: number | null
  Shortage_Qty: number | null
  Surplus_Qty: number | null
  Sellable_Forward_Qty: number | null
  Status: 'Matched' | 'Discrepancy' | 'Unmapped'
  Needs_Review: boolean
  Manager_ID: string | null
  Submitted_At: string | null
  Notes: string
}

/** routes/reconciliation.ts summarizeRows payload. */
export interface ReconSummary {
  rowCount: number
  matched: number
  discrepancy: number
  unmapped: number
  needsReview: number
  atRiskSkus: number
  dockedQty: number
  dockedValueNGN: number
  undockedQty: number
  undockedValueNGN: number
  totalVarianceValueNGN: number
}

/** services/schema.ts SkuMappingEntry. */
export interface SkuMappingEntry {
  leverEdgeSkuCode: string
  leverEdgeItemName: string
  xeroItemCode: string
  xeroItemName: string
  csFactor: number
  dzFactor: number
  category: string
  active: boolean
}

export type SkuMappingInput = SkuMappingEntry

export interface SkuMappingImportResult {
  created: number
  updated: number
  total: number
  errors: Array<{ line: number; reason: string }>
}

/** routes/audit.ts entry (AuditLog sheet columns). */
export interface AuditEntry {
  Timestamp: string
  Actor_ID: string
  Actor_Email: string
  Action: string
  Date: string | null
  Location: string | null
  Details: string
}

export interface AuditQuery {
  date?: string
  location?: string
  action?: string
  limit?: number
}

/** Manual count row — routes/reconciliation.ts ManualCountRow inside the counts JSON. */
export interface ManualCountRow {
  sku: string
  cs: number | null
  dz: number | null
  pc: number | null
  notes: string | null
}

export interface SubmitCounts {
  date: string
  location: string
  notes?: string | null
  rows: ManualCountRow[]
}

export interface SubmitInput {
  leveredge: File
  xero: File
  physical?: File | null
  counts: SubmitCounts
}

export interface SubmitResult {
  date: string
  location: string
  replacedRows: number
  parsed: { leveredge: number; xero: number; physical: number; manualCounts: number }
  summary: ReconSummary
}

export interface StatusResult {
  date: string
  location: string
  locked: boolean
  rowCount: number
  summary: ReconSummary
  rows: ReconciliationRow[]
}

export interface LoginResult {
  token: string
  user: AuthUser
}

/** Unmapped-SKU review queue item (mock-tracked; see deviations in lib/api.ts). */
export interface UnmappedSku {
  id: string
  sourceCode: string
  sourceName: string
  suggestionCode: string
  suggestionName: string
  confidence: number
}

export interface AuditListResult {
  count: number
  entries: AuditEntry[]
}

/** Error shape both implementations throw — mirrors backend {error, message?} bodies. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message?: string) {
    super(message ?? code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** localStorage keys for the persisted session (shared by both implementations). */
export const TOKEN_KEY = 'renuzi_token'
export const USER_KEY = 'renuzi_user'

/**
 * The one interface every page/component talks to. `VITE_API_MODE` selects the
 * implementation (mock | live) — flipping must require zero component changes.
 */
export interface RenuziApi {
  // auth
  login(email: string, password: string): Promise<LoginResult>
  me(): Promise<AuthUser>
  // reconciliation
  submitReconciliation(input: SubmitInput): Promise<SubmitResult>
  getReconciliationStatus(date: string, location: string): Promise<StatusResult>
  // sku mapping (admin)
  listMappings(): Promise<SkuMappingEntry[]>
  createMapping(entry: SkuMappingInput): Promise<SkuMappingEntry>
  updateMapping(code: string, patch: Partial<SkuMappingInput>): Promise<SkuMappingEntry>
  deleteMapping(code: string): Promise<SkuMappingEntry>
  importMappings(file: File): Promise<SkuMappingImportResult>
  // audit (executive + admin)
  listAudit(query?: AuditQuery): Promise<AuditListResult>
  // users (admin)
  listUsers(): Promise<AuthUser[]>
  // locations + unmapped queue (see deviations in lib/api.ts)
  listLocations(): Promise<string[]>
  listUnmappedSkus(): Promise<UnmappedSku[]>
  resolveUnmappedSku(item: UnmappedSku): Promise<SkuMappingEntry>
  dismissUnmappedSku(id: string): Promise<void>
}
