/**
 * Executive row flags — a client-side concern (the real API has no flag
 * endpoint). Persisted in localStorage in both mock and live modes; the flag
 * key is `${date}:${location}:${sku}`.
 */

const FLAG_KEY = 'renuzi.flags'

function load(): Record<string, boolean> {
  const raw = localStorage.getItem(FLAG_KEY)
  if (raw === null) return {}
  try {
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

function save(flags: Record<string, boolean>): void {
  localStorage.setItem(FLAG_KEY, JSON.stringify(flags))
}

export function flagKey(row: { Date: string; Location: string; SKU_Code: string }): string {
  return `${row.Date}:${row.Location}:${row.SKU_Code}`
}

export function listFlags(): Record<string, boolean> {
  return load()
}

export function isFlagged(row: { Date: string; Location: string; SKU_Code: string }): boolean {
  return Boolean(load()[flagKey(row)])
}

export function toggleFlag(row: { Date: string; Location: string; SKU_Code: string }): void {
  const flags = load()
  const key = flagKey(row)
  if (flags[key]) delete flags[key]
  else flags[key] = true
  save(flags)
}
