import { CUTOFF_HOUR, TIMEZONE } from '../config.js'

/**
 * Calendar date in TIMEZONE as 'YYYY-MM-DD' for the given instant.
 * Uses Intl with an explicit timeZone so results never depend on the host TZ.
 */
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function lagosDateString(now: Date): string {
  return dateFormatter.format(now)
}

/** Hour (0-23) and minute in TIMEZONE for the given instant. */
export function lagosHourMinute(now: Date): { hour: number; minute: number } {
  const [hour, minute] = timeFormatter
    .format(now)
    .split(':')
    .map((part) => Number(part))
  return { hour, minute }
}

/** True while current TIMEZONE wall-clock time is strictly before CUTOFF_HOUR. */
export function isBeforeCutoff(now: Date): boolean {
  return lagosHourMinute(now).hour < CUTOFF_HOUR
}

function normalizeDate(date: string | Date): string | null {
  if (date instanceof Date) return lagosDateString(date)
  const trimmed = date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed
}

/**
 * Daily cutoff lock.
 *
 * A submission for `date` is open only when BOTH hold:
 *  1. `date` is TODAY's calendar date in Africa/Lagos (yesterday/tomorrow are
 *     forever locked — the day is closed for audit), and
 *  2. the current Africa/Lagos time is before CUTOFF_HOUR (18:00 WAT).
 *
 * All comparisons are derived from the absolute instant via Intl with an
 * explicit timeZone, so behaviour is identical on any host timezone.
 */
export function isSubmissionOpen(date: string | Date, now: Date = new Date()): boolean {
  const target = normalizeDate(date)
  if (target === null) return false
  if (!isBeforeCutoff(now)) return false
  return target === lagosDateString(now)
}
