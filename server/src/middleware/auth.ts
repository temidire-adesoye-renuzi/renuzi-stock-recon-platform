import type { NextFunction, Request, Response } from 'express'
import type { SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config.js'
import { findById, sanitizeUser } from '../services/userStore.js'
import type { AuthUser, Role } from '../types.js'

interface TokenPayload {
  sub: string
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  const token = header.slice('Bearer '.length).trim()
  let payload: TokenPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  const stored = typeof payload.sub === 'string' ? findById(payload.sub) : undefined
  if (!stored || stored.deactivated) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  req.user = sanitizeUser(stored)
  next()
}

/**
 * Restrict a route to the given roles. Must run after requireAuth.
 * A super_admin passes EVERY role guard, whatever the list contains.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || (req.user.role !== 'super_admin' && !roles.includes(req.user.role))) {
      res.status(403).json({ error: 'FORBIDDEN' })
      return
    }
    next()
  }
}

function targetLocation(req: Request): string | undefined {
  const candidates = [req.params?.location, req.body?.location, req.query?.location]
  const found = candidates.find((value) => typeof value === 'string' && value.trim() !== '')
  return typeof found === 'string' ? found.trim() : undefined
}

/**
 * Warehouse managers may only act on their own location.
 * Admins and executives bypass the check. Must run after requireAuth.
 */
export function requireLocation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }
  if (req.user.role !== 'warehouse_manager') {
    next()
    return
  }
  const target = targetLocation(req)
  if (!target) {
    res.status(400).json({ error: 'LOCATION_REQUIRED' })
    return
  }
  if (!req.user.location || req.user.location.toLowerCase() !== target.toLowerCase()) {
    res.status(403).json({ error: 'LOCATION_FORBIDDEN' })
    return
  }
  next()
}

export function issueToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role, location: user.location }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
  })
}
