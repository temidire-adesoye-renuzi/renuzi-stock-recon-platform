import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'

const app = createApp()

const SEED_LOGINS = [
  { email: 'admin@renuzi', password: 'Admin@2026', role: 'admin', location: undefined },
  { email: 'ketu@renuzi', password: 'Ketu@2026', role: 'warehouse_manager', location: 'Ketu' },
  { email: 'lekki@renuzi', password: 'Lekki@2026', role: 'warehouse_manager', location: 'Lekki' },
]

const tokens: Record<string, string> = {}

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    for (const seed of SEED_LOGINS) {
      const res = await request(app).post('/api/v1/auth/login').send(seed)
      tokens[seed.email] = res.body.token
    }
  })

  for (const seed of SEED_LOGINS) {
    it(`logs in ${seed.email} and returns the correct role`, async () => {
      const res = await request(app).post('/api/v1/auth/login').send(seed)
      expect(res.status).toBe(200)
      expect(typeof res.body.token).toBe('string')
      expect(res.body.user).toMatchObject({
        email: seed.email,
        role: seed.role,
        ...(seed.location ? { location: seed.location } : {}),
      })
      expect(res.body.user.passwordHash).toBeUndefined()
    })
  }

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@renuzi', password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'INVALID_CREDENTIALS' })
  })

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@renuzi', password: 'whatever' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'INVALID_CREDENTIALS' })
  })

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@renuzi' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'EMAIL_AND_PASSWORD_REQUIRED' })
  })
})

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokens['admin@renuzi']}`)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: 'admin@renuzi', role: 'admin' })
  })

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('rejects invalid tokens', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nope')
    expect(res.status).toBe(401)
  })
})

describe('RBAC over HTTP', () => {
  it('blocks a plain admin from /api/v1/admin/users (super_admin only)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokens['admin@renuzi']}`)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'FORBIDDEN' })
  })

  it('blocks a warehouse_manager token from admin routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokens['ketu@renuzi']}`)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'FORBIDDEN' })
  })

  it('blocks unauthenticated access to admin routes', async () => {
    const res = await request(app).get('/api/v1/admin/users')
    expect(res.status).toBe(401)
  })
})

describe('Daily cutoff lock over HTTP', () => {
  it('blocks any write request targeting a past date with 403 LOCKED_FOR_AUDIT', async () => {
    const res = await request(app)
      .post('/api/v1/submissions')
      .query({ date: '2020-01-01' })
      .send({})
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'LOCKED_FOR_AUDIT' })
  })

  it('exempts login from the cutoff lock', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@renuzi', password: 'Admin@2026' })
    expect(res.status).toBe(200)
  })
})
