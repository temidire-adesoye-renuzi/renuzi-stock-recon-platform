import { Router } from 'express'
import type { Role } from '../types.js'
import { createUser, deactivateUser, listUsers } from '../services/userStore.js'

/**
 * User management API. Mounted under /api/v1/admin/users behind
 * requireAuth + requireRole('super_admin') — plain admins have no access
 * (intended: account lifecycle belongs to the super admin alone).
 */
export const adminUsersRouter = Router()

adminUsersRouter.get('/', (_req, res): void => {
  res.json({ users: listUsers() })
})

adminUsersRouter.post('/', (req, res): void => {
  const body = req.body as Record<string, unknown>
  const result = createUser({
    email: String(body.email ?? ''),
    name: String(body.name ?? ''),
    role: body.role as Role,
    ...(body.location === undefined ? {} : { location: String(body.location) }),
    password: String(body.password ?? ''),
  })
  if (!result.ok) {
    res.status(result.error === 'EMAIL_EXISTS' ? 409 : 400).json({ error: result.error })
    return
  }
  res.status(201).json({ user: result.user })
})

adminUsersRouter.patch('/:id/deactivate', (req, res): void => {
  if (req.params.id === req.user?.id) {
    res.status(400).json({ error: 'CANNOT_DEACTIVATE_SELF' })
    return
  }
  const result = deactivateUser(req.params.id)
  if (!result.ok) {
    res.status(404).json({ error: result.error })
    return
  }
  res.json({ user: result.user })
})
