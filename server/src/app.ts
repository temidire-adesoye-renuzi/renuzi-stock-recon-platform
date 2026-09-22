import express from 'express'
import cors from 'cors'
import { requireCutoffOpen } from './middleware/cutoff.js'
import { requireAuth, requireRole } from './middleware/auth.js'
import { adminRouter } from './routes/admin.js'
import { auditRouter } from './routes/audit.js'
import { authRouter } from './routes/auth.js'
import { reconciliationRouter } from './routes/reconciliation.js'
import { reportedGraphMode } from './services/storage/index.js'

export function createApp(): express.Express {
  const app = express()
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

  app.use(cors({ origin: clientOrigin }))
  app.use(express.json())

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'renuzi-stock-recon-api',
      storageMode: reportedGraphMode(),
    })
  })

  // Daily cutoff lock: every write endpoint (except login) is blocked once the
  // Lagos clock reaches CUTOFF_HOUR, or whenever it targets a non-today date.
  app.use('/api/v1', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next()
      return
    }
    if (req.path === '/auth/login') {
      next()
      return
    }
    requireCutoffOpen(req, res, next)
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/reconciliation', requireAuth, reconciliationRouter)
  // Audit trail: executives read it too, so mount BEFORE the admin-only tree.
  app.use('/api/v1/admin/audit', requireAuth, requireRole('executive', 'admin'), auditRouter)
  app.use('/api/v1/admin', requireAuth, requireRole('admin'), adminRouter)

  return app
}
