import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'

/**
 * super_admin + user management API tests. These run against a TEMPORARY copy
 * of users.json (create/deactivate WRITE to it) so the real server/data
 * users.json is never mutated. Env vars are set before dynamically importing
 * the app so config picks them up.
 */
const tempDir = mkdtempSync(join(tmpdir(), 'renuzi-users-'))
const usersPath = join(tempDir, 'users.json')

const SEED_USERS = [
  {
    id: 'usr_admin',
    email: 'admin@renuzi',
    name: 'Renuzi Admin',
    role: 'admin',
    passwordHash: bcrypt.hashSync('Admin@2026', 10),
  },
  {
    id: 'usr_super',
    email: 'temidire@renuzi',
    name: 'Temidire Super Admin',
    role: 'super_admin',
    passwordHash: bcrypt.hashSync('Super@2026', 10),
  },
]

let app: import('express').Express
let adminToken: string
let superToken: string
let superAdminId: string

beforeAll(async () => {
  writeFileSync(usersPath, JSON.stringify({ users: SEED_USERS }, null, 2), 'utf-8')
  process.env.USERS_FILE = usersPath
  process.env.CUTOFF_HOUR = '24' // never locked — route tests must be time-independent
  process.env.SKU_SEED_PATH = join(tempDir, 'does-not-exist.csv') // nonexistent on purpose
  process.env.MASTER_WORKBOOK_PATH = join(tempDir, 'master_workbook.xlsx')
  const { createApp } = await import('../app.js')
  app = createApp()

  const login = async (email: string, password: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password })
    expect(res.status).toBe(200)
    return res.body
  }
  adminToken = (await login('admin@renuzi', 'Admin@2026')).token
  const superBody = await login('temidire@renuzi', 'Super@2026')
  superToken = superBody.token
  superAdminId = superBody.user.id
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('requireRole: super_admin bypasses every guard', () => {
  const superAdminUser = {
    id: 'usr_super',
    email: 'temidire@renuzi',
    name: 'Temidire Super Admin',
    role: 'super_admin',
  }

  function run(mw: (req: Request, res: Response, next: NextFunction) => void) {
    const req = { user: superAdminUser } as unknown as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn()
    mw(req, res, next)
    return { res, next }
  }

  it('passes an admin-only guard', async () => {
    const { requireRole } = await import('../middleware/auth.js')
    const { res, next } = run(requireRole('admin'))
    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('passes a guard whose role list does not include super_admin', async () => {
    const { requireRole } = await import('../middleware/auth.js')
    const { res, next } = run(requireRole('executive', 'warehouse_manager'))
    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('POST/GET/PATCH /api/v1/admin/users access control', () => {
  it('gives a plain admin 403 on every /admin/users endpoint', async () => {
    const get = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(get.status).toBe(403)
    expect(get.body).toEqual({ error: 'FORBIDDEN' })

    const post = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'x@renuzi', name: 'X', role: 'executive', password: 'X@2026pwd' })
    expect(post.status).toBe(403)
    expect(post.body).toEqual({ error: 'FORBIDDEN' })

    const patch = await request(app)
      .patch('/api/v1/admin/users/usr_admin/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(patch.status).toBe(403)
    expect(patch.body).toEqual({ error: 'FORBIDDEN' })
  })

  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/admin/users')
    expect(res.status).toBe(401)
  })

  it('lets the super_admin list users, sanitized with a deactivated flag', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(2)
    for (const user of res.body.users) {
      expect(user.passwordHash).toBeUndefined()
      expect(user).toHaveProperty('deactivated')
    }
  })
})

describe('user lifecycle via the API', () => {
  it('super_admin creates a user and that user can log in', async () => {
    const create = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        email: 'nurse@renuzi',
        name: 'New Executive',
        role: 'executive',
        password: 'Exec@2026',
      })
    expect(create.status).toBe(201)
    expect(create.body.user).toMatchObject({
      email: 'nurse@renuzi',
      name: 'New Executive',
      role: 'executive',
      deactivated: false,
    })
    expect(create.body.user.passwordHash).toBeUndefined()

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nurse@renuzi', password: 'Exec@2026' })
    expect(login.status).toBe(200)
    expect(typeof login.body.token).toBe('string')
    expect(login.body.user).toMatchObject({ email: 'nurse@renuzi', role: 'executive' })
  })

  it('rejects duplicate emails with 409', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ email: 'NURSE@renuzi', name: 'Dup', role: 'executive', password: 'Exec@2026' })
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'EMAIL_EXISTS' })
  })

  it('rejects invalid payloads with 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ email: 'not-an-email', name: '', role: 'warlord', password: '' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'INVALID_USER' })
  })

  it('blocks self-deactivation with 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${superAdminId}/deactivate`)
      .set('Authorization', `Bearer ${superToken}`)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'CANNOT_DEACTIVATE_SELF' })
  })

  it('deactivates another user, whose login and token then fail with 401', async () => {
    const deactivate = await request(app)
      .patch('/api/v1/admin/users/usr_admin/deactivate')
      .set('Authorization', `Bearer ${superToken}`)
    expect(deactivate.status).toBe(200)
    expect(deactivate.body.user).toMatchObject({ id: 'usr_admin', deactivated: true })

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@renuzi', password: 'Admin@2026' })
    expect(login.status).toBe(401)
    expect(login.body).toEqual({ error: 'INVALID_CREDENTIALS' })

    // Tokens issued before deactivation stop working too.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(me.status).toBe(401)

    const list = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superToken}`)
    const admin = list.body.users.find((user: { id: string }) => user.id === 'usr_admin')
    expect(admin.deactivated).toBe(true)
  })

  it('returns 404 for an unknown user id', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/usr_ghost/deactivate')
      .set('Authorization', `Bearer ${superToken}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'USER_NOT_FOUND' })
  })
})
