import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { isSubmissionOpen, lagosDateString } from '../services/cutoff.js'
import { requireCutoffOpen } from '../middleware/cutoff.js'

/**
 * WAT is UTC+1 year-round (no DST). Building instants with an explicit offset
 * keeps every case identical regardless of the host machine's timezone.
 */
const WAT = (wallClock: string) => new Date(`${wallClock}:00+01:00`)

describe('isSubmissionOpen — cutoff boundary', () => {
  // Calendar reference: 2026-09-21. All wall-clock times are Africa/Lagos.
  it('is open at 17:59 WAT today', () => {
    expect(isSubmissionOpen('2026-09-21', WAT('2026-09-21T17:59'))).toBe(true)
  })

  it('is open at 17:59 WAT today when expressed as a UTC instant', () => {
    expect(isSubmissionOpen('2026-09-21', new Date('2026-09-21T16:59:00Z'))).toBe(true)
  })

  it('locks exactly at 18:00 WAT', () => {
    expect(isSubmissionOpen('2026-09-21', WAT('2026-09-21T18:00'))).toBe(false)
  })

  it('locks at 18:01 WAT today', () => {
    expect(isSubmissionOpen('2026-09-21', WAT('2026-09-21T18:01'))).toBe(false)
  })
})

describe('isSubmissionOpen — date must be Lagos today', () => {
  it('locks yesterday at any time of day', () => {
    for (const now of ['2026-09-21T00:05', '2026-09-21T09:00', '2026-09-21T17:59']) {
      expect(isSubmissionOpen('2026-09-20', WAT(now))).toBe(false)
    }
  })

  it('locks tomorrow', () => {
    expect(isSubmissionOpen('2026-09-22', WAT('2026-09-21T09:00'))).toBe(false)
  })

  it('opens the new date right after Lagos midnight', () => {
    expect(isSubmissionOpen('2026-09-22', WAT('2026-09-22T00:05'))).toBe(true)
  })

  it('interprets a Date argument by its Lagos calendar date', () => {
    expect(isSubmissionOpen(WAT('2026-09-21T09:00'), WAT('2026-09-21T10:00'))).toBe(true)
    expect(isSubmissionOpen(WAT('2026-09-20T09:00'), WAT('2026-09-21T10:00'))).toBe(false)
  })

  it('rejects malformed dates', () => {
    expect(isSubmissionOpen('not-a-date', WAT('2026-09-21T09:00'))).toBe(false)
    expect(isSubmissionOpen('2026-9-21', WAT('2026-09-21T09:00'))).toBe(false)
    expect(isSubmissionOpen('', WAT('2026-09-21T09:00'))).toBe(false)
  })
})

describe('isSubmissionOpen — mocked system clock (default now)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads the clock: 17:59 WAT today is open', () => {
    vi.setSystemTime(WAT('2026-09-21T17:59'))
    expect(isSubmissionOpen(lagosDateString(new Date()))).toBe(true)
  })

  it('reads the clock: 18:01 WAT today is locked', () => {
    vi.setSystemTime(WAT('2026-09-21T18:01'))
    expect(isSubmissionOpen(lagosDateString(new Date()))).toBe(false)
  })

  it('reads the clock: yesterday is locked at 09:00 WAT', () => {
    vi.setSystemTime(WAT('2026-09-21T09:00'))
    expect(isSubmissionOpen('2026-09-20')).toBe(false)
  })
})

describe('requireCutoffOpen middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function run(reqOverrides: Record<string, unknown> = {}) {
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
    requireCutoffOpen(req, res, next)
    return { status, json, next }
  }

  it('passes before the cutoff', () => {
    vi.setSystemTime(WAT('2026-09-21T17:59'))
    const { status, next } = run()
    expect(next).toHaveBeenCalledTimes(1)
    expect(status).not.toHaveBeenCalled()
  })

  it('returns 403 LOCKED_FOR_AUDIT after the cutoff', () => {
    vi.setSystemTime(WAT('2026-09-21T18:01'))
    const { status, json, next } = run()
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ error: 'LOCKED_FOR_AUDIT' })
  })

  it('returns 403 for an explicit past date even before the cutoff', () => {
    vi.setSystemTime(WAT('2026-09-21T09:00'))
    const { status, json, next } = run({ body: { date: '2026-09-20' } })
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({ error: 'LOCKED_FOR_AUDIT' })
  })

  it('passes for an explicit today date before the cutoff', () => {
    vi.setSystemTime(WAT('2026-09-21T09:00'))
    const { status, next } = run({ body: { date: '2026-09-21' } })
    expect(next).toHaveBeenCalledTimes(1)
    expect(status).not.toHaveBeenCalled()
  })
})
