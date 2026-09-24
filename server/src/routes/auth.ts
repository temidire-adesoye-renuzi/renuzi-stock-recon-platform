import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { issueToken, requireAuth } from '../middleware/auth.js'
import { findByEmail, sanitizeUser } from '../services/userStore.js'

export const authRouter = Router()

authRouter.post('/login', (req, res): void => {
  const { email, password } = req.body as { email?: unknown; password?: unknown }
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email === '' ||
    password === ''
  ) {
    res.status(400).json({ error: 'EMAIL_AND_PASSWORD_REQUIRED' })
    return
  }

  const user = findByEmail(email)
  const valid = user ? bcrypt.compareSync(password, user.passwordHash) : false
  if (!user || user.deactivated || !valid) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    return
  }

  const sanitized = sanitizeUser(user)
  res.json({ token: issueToken(sanitized), user: sanitized })
})

authRouter.get('/me', requireAuth, (req, res): void => {
  res.json({ user: req.user })
})
