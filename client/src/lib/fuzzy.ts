/**
 * Name matching — client mirror of server/src/services/skuMatching.ts
 * (normalizeItemName + Dice bigram similarity, FUZZY_THRESHOLD = 0.85).
 */

export const FUZZY_THRESHOLD = 0.85

/** Uppercase, strip punctuation and collapse extra spaces. */
export function normalizeItemName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** Dice coefficient (bigram similarity): 1 = identical, 0 = disjoint. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2)
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1)
  }
  let overlap = 0
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2)
    const count = bigrams.get(gram) ?? 0
    if (count > 0) {
      overlap += 1
      bigrams.set(gram, count - 1)
    }
  }
  return (2 * overlap) / (a.length - 1 + b.length - 1)
}

export interface FuzzySuggestion {
  code: string
  name: string
  similarity: number
}

/** Best mapping suggestion (code + name + Dice score) for an unmapped item name. */
export function bestMatch(
  sourceName: string,
  candidates: Array<{ code: string; name: string }>
): FuzzySuggestion | null {
  const normalized = normalizeItemName(sourceName)
  if (normalized === '') return null
  let best: FuzzySuggestion | null = null
  for (const candidate of candidates) {
    const similarity = diceCoefficient(normalized, normalizeItemName(candidate.name))
    if (best === null || similarity > best.similarity) {
      best = { code: candidate.code, name: candidate.name, similarity }
    }
  }
  return best
}
