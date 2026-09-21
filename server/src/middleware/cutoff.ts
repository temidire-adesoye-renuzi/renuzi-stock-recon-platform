import type { NextFunction, Request, Response } from 'express'
import { isSubmissionOpen, lagosDateString } from '../services/cutoff.js'

/**
 * Blocks write requests once the daily cutoff lock is engaged.
 *
 * The audited date defaults to TODAY in Africa/Lagos; a request may target an
 * explicit date via `date` in params, body, or query (e.g. editing a specific
 * day's submission) — any date other than today is always locked.
 */
export function requireCutoffOpen(req: Request, res: Response, next: NextFunction): void {
  const explicit = [req.params?.date, req.body?.date, req.query?.date].find(
    (value) => typeof value === 'string' && value.trim() !== '',
  )
  const target = typeof explicit === 'string' ? explicit : lagosDateString(new Date())

  if (!isSubmissionOpen(target)) {
    res.status(403).json({ error: 'LOCKED_FOR_AUDIT' })
    return
  }
  next()
}
