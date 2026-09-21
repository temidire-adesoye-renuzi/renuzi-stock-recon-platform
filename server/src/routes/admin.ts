import { Router } from 'express'
import { listUsers } from '../services/userStore.js'

export const adminRouter = Router()

adminRouter.get('/users', (_req, res): void => {
  res.json({ users: listUsers() })
})
