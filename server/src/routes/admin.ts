import { Router } from 'express'
import { skuMappingRouter } from './skuMapping.js'

/**
 * Admin API. Mounted under /api/v1/admin behind requireAuth + requireRole('admin').
 * User management lives in adminUsers.ts (super_admin only).
 */
export const adminRouter = Router()

adminRouter.use('/sku-mapping', skuMappingRouter)
