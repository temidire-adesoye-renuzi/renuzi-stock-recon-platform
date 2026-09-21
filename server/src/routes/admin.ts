import { Router } from 'express'
import { listUsers } from '../services/userStore.js'
import { skuMappingRouter } from './skuMapping.js'

export const adminRouter = Router()

adminRouter.get('/users', (_req, res): void => {
  res.json({ users: listUsers() })
})

adminRouter.use('/sku-mapping', skuMappingRouter)
