import { Router } from 'express'
import { listUsers } from '../services/userStore.js'
import { skuMappingRouter } from './skuMapping.js'

/**
 * Admin API. Mounted under /api/v1/admin behind requireAuth + requireRole('admin').
 */
export const adminRouter = Router()

adminRouter.get('/users', (_req, res): void => {
  res.json({ users: listUsers() })
})

adminRouter.use('/sku-mapping', skuMappingRouter)
