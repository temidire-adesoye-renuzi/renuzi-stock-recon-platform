/**
 * Africa/Lagos (WAT) clock helpers — client mirror of server/src/services/cutoff.ts.
 * All comparisons go through Intl with an explicit timeZone so behaviour never
 * depends on the host timezone.
 */

export const TIMEZONE = 'Africa/Lagos'

/**
 * WAT hour (0-23) at which submissions lock for the rest of the day. Mirrors
 * the server's CUTOFF_HOUR env: fixed 18:00 live-side; in mock mode an optional
 * VITE_CUTOFF_HOUR can shift it for after-hours demos (default stays 18:00).
 */
export const CUTOFF_HOUR =
  import.meta.env.VITE_API_MODE === 'live'
    ? 18
    : Number(import.meta.env.VITE_CUTOFF_HOUR ?? 18) || 18

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

/** Calendar date in Lagos as 'YYYY-MM-DD' for the given instant. */
export function lagosDateString(now: Date = new Date()): string {
  return dateFormatter.format(now)
}

export function lagosHourMinute(now: Date = new Date()): { hour: number; minute: number } {
  const [hour, minute] = timeFormatter
    .format(now)
    .split(':')
    .map((part) => Number(part))
  return { hour, minute }
}

/** Wall-clock time label in Lagos, e.g. "12:04 PM". */
export function lagosClockLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now)
}

export function isBeforeCutoff(now: Date = new Date()): boolean {
  return lagosHourMinute(now).hour < CUTOFF_HOUR
}

/** Seconds from now until the 18:00 WAT cutoff (0 once locked for the day). */
export function secondsUntilCutoff(now: Date = new Date()): number {
  if (!isBeforeCutoff(now)) return 0
  const { hour, minute } = lagosHourMinute(now)
  const nowSeconds = hour * 3600 + minute * 60 + now.getSeconds()
  return Math.max(0, CUTOFF_HOUR * 3600 - nowSeconds)
}

/**
 * Mirror of the server rule: a submission for `date` is open only when the date
 * is TODAY in Lagos AND the Lagos wall clock is strictly before 18:00.
 */
export function isSubmissionOpen(date: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (!isBeforeCutoff(now)) return false
  return date === lagosDateString(now)
}

/** Today plus the previous n-1 dates in Lagos time, oldest first. */
export function lastLagosDates(n: number, now: Date = new Date()): string[] {
  const dates: string[] = []
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const instant = new Date(now.getTime() - offset * 86_400_000)
    dates.push(lagosDateString(instant))
  }
  return dates
}
