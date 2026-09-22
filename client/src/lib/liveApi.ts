import axios from 'axios'
import {
  ApiError,
  TOKEN_KEY,
  USER_KEY,
  type AuditListResult,
  type AuditQuery,
  type AuthUser,
  type LoginResult,
  type ReconSummary,
  type ReconciliationRow,
  type RenuziApi,
  type SkuMappingEntry,
  type SkuMappingImportResult,
  type SubmitInput,
  type SubmitResult,
  type UnmappedSku,
} from './apiTypes'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

const http = axios.create({ baseURL })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login') window.location.replace('/login')
    }
    return Promise.reject(error)
  },
)

function fail(error: unknown): never {
  if (error instanceof ApiError) throw error
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const body = error.response?.data as { error?: string; message?: string } | undefined
    if (body?.error) throw new ApiError(body.error, status, body.message)
    if (status === 0) throw new ApiError('NETWORK_ERROR', 0, 'Cannot reach the Renuzi API.')
  }
  throw new ApiError('UNKNOWN_ERROR', 0, (error as Error)?.message)
}

function toAuthUser(raw: unknown): AuthUser {
  return raw as AuthUser
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    return fail(error)
  }
}

interface RawStatus {
  date: string
  location: string
  locked: boolean
  rowCount: number
  summary: ReconSummary
  rows: ReconciliationRow[]
}

export const liveApi: RenuziApi = {
  login: (email, password) =>
    guarded(async () => {
      const { data } = await http.post<LoginResult>('/auth/login', { email, password })
      return data
    }),

  me: () =>
    guarded(async () => {
      const { data } = await http.get<{ user: AuthUser }>('/auth/me')
      return toAuthUser(data.user)
    }),

  submitReconciliation: (input: SubmitInput) =>
    guarded(async () => {
      const form = new FormData()
      form.append('leveredge', input.leveredge)
      form.append('xero', input.xero)
      if (input.physical) form.append('physical', input.physical)
      form.append('counts', JSON.stringify(input.counts))
      const { data } = await http.post<SubmitResult>('/reconciliation/submit', form)
      return data
    }),

  getReconciliationStatus: (date, location) =>
    guarded(async () => {
      const { data } = await http.get<RawStatus>('/reconciliation/status', {
        params: { date, location },
      })
      return data
    }),

  listMappings: () =>
    guarded(async () => {
      const { data } = await http.get<{ mappings: SkuMappingEntry[] }>(
        '/admin/sku-mapping',
      )
      return data.mappings
    }),

  createMapping: (entry) =>
    guarded(async () => {
      const { data } = await http.post<{ mapping: SkuMappingEntry }>(
        '/admin/sku-mapping',
        entry,
      )
      return data.mapping
    }),

  updateMapping: (code, patch) =>
    guarded(async () => {
      const { data } = await http.put<{ mapping: SkuMappingEntry }>(
        `/admin/sku-mapping/${encodeURIComponent(code)}`,
        patch,
      )
      return data.mapping
    }),

  deleteMapping: (code) =>
    guarded(async () => {
      const { data } = await http.delete<{ mapping: SkuMappingEntry }>(
        `/admin/sku-mapping/${encodeURIComponent(code)}`,
      )
      return data.mapping
    }),

  importMappings: (file) =>
    guarded(async () => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await http.post<SkuMappingImportResult>(
        '/admin/sku-mapping/import',
        form,
      )
      return data
    }),

  listAudit: (query?: AuditQuery) =>
    guarded(async () => {
      const { data } = await http.get<AuditListResult>('/admin/audit', {
        params: query,
      })
      return data
    }),

  listUsers: () =>
    guarded(async () => {
      const { data } = await http.get<{ users: AuthUser[] }>('/admin/users')
      return data.users
    }),

  // No real endpoint — see deviations in lib/api.ts.
  listLocations: () => Promise.resolve(['Ketu', 'Lekki']),
  listUnmappedSkus: () => Promise.resolve<UnmappedSku[]>([]),
  resolveUnmappedSku: () =>
    Promise.reject(new ApiError('NOT_AVAILABLE_LIVE', 400, 'Unmapped queue is mock-only.')),
  dismissUnmappedSku: () => Promise.resolve(),
}
