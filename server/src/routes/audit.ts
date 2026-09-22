import { Router, type Request, type Response } from 'express'
import { AUDITLOG_SHEET } from '../services/schema.js'
import { getStorage, storageReady } from '../services/storage/index.js'

/**
 * Audit trail API (executive + admin). Mounted at /api/v1/admin/audit.
 */
export const auditRouter = Router()

auditRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : null
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : null
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : null
  const limitParam = Number(typeof req.query.limit === 'string' ? req.query.limit : '200')
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 1000 ? limitParam : 200

  await storageReady()
  const rows = await getStorage().readTable(AUDITLOG_SHEET)
  const filtered = rows.filter((row) => {
    if (date && String(row.Date) !== date) return false
    if (location && String(row.Location).toLowerCase() !== location.toLowerCase()) return false
    if (action && String(row.Action) !== action) return false
    return true
  })
  const sorted = filtered.sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp)))
  res.json({ count: sorted.length, entries: sorted.slice(0, limit) })
})
