import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'
import { requireAuth, requireLocation, requireRole } from '../middleware/auth.js'
import { findByEmail, sanitizeUser } from '../services/userStore.js'
import type { AuthUser } from '../types.js'

type Middleware = (req: Request, res: Response, next: NextFunction) => void

function run(mw: Middleware, reqOverrides: Record<string, unknown> = {}) {
  const req = {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...reqOverrides,
  } as unknown as Request
  const status = vi.fn().mockReturnThis()
  const json = vi.fn().mockReturnThis()
  const res = { status, json } as unknown as Response
  const next = vi.fn()
  mw(req, res, next)
  return { req, status, json, next }
}

const executiveUser: AuthUser = {
  id: 'usr_exec_test',
  email: 'exec@renuzi',
  name: 'Executive (unseeded)',
  role: 'executive',
}

describe('requireAuth', () => {
  let adminToken: string
  let adminId: string

  beforeAll(() => {
    const admin = findByEmail('admin@renuzi')
    expect(admin).toBeDefined()
    adminId = admin!.id
    adminToken = jwt.sign({ sub: adminId }, JWT_SECRET)
  })

  it('rejects requests without an Authorization header', () => {
    const { status, json, next } = run(requireAuth)
    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith({ error: 'UNAUTHORIZED' })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects malformed tokens', () => {
    const { status, next } = run(requireAuth, {
      headers: { authorization: 'Bearer not-a-jwt' },
    })
    expect(status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a valid signature for a deleted/unknown user', () => {
    const { status, next } = run(requireAuth, {
      headers: { authorization: `Bearer ${jwt.sign({ sub: 'usr_ghost' }, JWT_SECRET)}` },
    })
    expect(status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('accepts a valid token and attaches the user', () => {
    const { req, status, next } = run(requireAuth, {
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.user).toMatchObject({ id: adminId, email: 'admin@renuzi', role: 'admin' })
  })
})

describe('requireRole', () => {
  it('allows an admin on an admin-only guard', () => {
    const { status, next } = run(requireRole('admin'), {
      user: sanitizeUser(findByEmail('admin@renuzi')!),
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('blocks a warehouse_manager on an admin-only guard', () => {
    const { status, json, next } = run(requireRole('admin'), {
      user: sanitizeUser(findByEmail('ketu@renuzi')!),
    })
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ error: 'FORBIDDEN' })
    expect(next).not.toHaveBeenCalled()
  })

  it('allows a warehouse_manager when the role list includes it', () => {
    const { status, next } = run(requireRole('executive', 'warehouse_manager'), {
      user: sanitizeUser(findByEmail('ketu@renuzi')!),
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('blocks requests with no authenticated user', () => {
    const { status, json, next } = run(requireRole('admin'))
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ error: 'FORBIDDEN' })
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireLocation', () => {
  it('allows a manager on their own location (params)', () => {
    const { status, next } = run(requireLocation, {
      user: sanitizeUser(findByEmail('ketu@renuzi')!),
      params: { location: 'Ketu' },
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('is case-insensitive about the location name', () => {
    const { status, next } = run(requireLocation, {
      user: sanitizeUser(findByEmail('ketu@renuzi')!),
      query: { location: 'ketu' },
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('blocks a manager from another location (params, body, query)', () => {
    const ketu = sanitizeUser(findByEmail('ketu@renuzi')!)
    for (const overrides of [
      { user: ketu, params: { location: 'Lekki' } },
      { user: ketu, body: { location: 'Lekki' } },
      { user: ketu, query: { location: 'Lekki' } },
    ]) {
      const { status, json, next } = run(requireLocation, overrides)
      expect(status).toHaveBeenCalledWith(403)
      expect(json).toHaveBeenCalledWith({ error: 'LOCATION_FORBIDDEN' })
      expect(next).not.toHaveBeenCalled()
    }
  })

  it('rejects a manager when no target location can be resolved', () => {
    const { status, json, next } = run(requireLocation, {
      user: sanitizeUser(findByEmail('ketu@renuzi')!),
    })
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: 'LOCATION_REQUIRED' })
    expect(next).not.toHaveBeenCalled()
  })

  it('lets admins bypass the location check', () => {
    const { status, next } = run(requireLocation, {
      user: sanitizeUser(findByEmail('admin@renuzi')!),
      params: { location: 'Lekki' },
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('lets executives bypass the location check', () => {
    const { status, next } = run(requireLocation, {
      user: executiveUser,
      params: { location: 'Ketu' },
    })
    expect(status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })
})
