export function formatNaira(value: number, options?: { compact?: boolean }): string {
  if (options?.compact) {
    if (Math.abs(value) >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`
    if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`
    return `₦${value.toFixed(0)}`
  }
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

export function formatSigned(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return `${rounded > 0 ? '+' : ''}${formatNumber(rounded)}`
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m remaining`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s remaining`
}

/** "2026-09-22" -> "Tue, 22 Sep 2026" (UTC-safe parse of the date literal). */
export function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "2026-09-22" -> "22 Sep" for chart axes. */
export function formatDayMonth(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
