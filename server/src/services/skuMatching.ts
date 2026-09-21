import type { SkuMappingEntry } from './schema.js'
import { round3 } from './math.js'

/**
 * SKU matching service. Resolves items from any source to a canonical group
 * key, in strict order:
 *   1. exact match on a mapped code (LeverEdge or Xero code in the seed)
 *   2. normalized name match (uppercase, punctuation/extra spaces stripped)
 *   3. fuzzy match with Dice bigram similarity >= 0.85 (flagged needsReview)
 *   4. otherwise Unmapped
 */

export const FUZZY_THRESHOLD = 0.85

export type SkuMatchMethod = 'code' | 'name' | 'fuzzy' | 'none'

export interface SkuMatch {
  method: SkuMatchMethod
  /** Canonical group key, or null when unmatched. */
  key: string | null
  needsReview: boolean
  similarity: number | null
  entry: SkuMappingEntry | null
}

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
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2)
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1)
  }
  let overlap = 0
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2)
    const count = bigrams.get(gram) ?? 0
    if (count > 0) {
      overlap += 1
      bigrams.set(gram, count - 1)
    }
  }
  return (2 * overlap) / (a.length - 1 + b.length - 1)
}

export function mappingKey(entry: SkuMappingEntry): string {
  return `mapping:${entry.leverEdgeSkuCode.trim()}`
}

/**
 * Name index: normalized item name -> canonical group key. The reconciliation
 * engine registers every item it groups so later sources can match by name.
 */
export type NameIndex = ReadonlyMap<string, string>

/**
 * Merge guard: returns false when the engine must not merge into the given
 * group key (e.g. the group already contains an item from the same source —
 * name/fuzzy matching joins sources, it never de-duplicates within one).
 */
export type MergeGuard = (key: string) => boolean

export class SkuMatcher {
  private readonly byCode = new Map<string, SkuMappingEntry>()
  private readonly mappingNames = new Map<string, string>()

  constructor(mapping: SkuMappingEntry[]) {
    for (const entry of mapping) {
      if (!entry.active) continue
      for (const code of [entry.leverEdgeSkuCode, entry.xeroItemCode]) {
        const trimmed = code.trim()
        if (trimmed !== '' && !this.byCode.has(trimmed)) this.byCode.set(trimmed, entry)
      }
      const key = mappingKey(entry)
      for (const name of [entry.leverEdgeItemName, entry.xeroItemName]) {
        const normalized = normalizeItemName(name)
        if (normalized !== '' && !this.mappingNames.has(normalized)) {
          this.mappingNames.set(normalized, key)
        }
      }
    }
  }

  match(sku: string, name: string, nameIndex: NameIndex, canMerge?: MergeGuard): SkuMatch {
    // 1. exact mapped code
    const entry = this.byCode.get(sku.trim())
    if (entry) {
      return { method: 'code', key: mappingKey(entry), needsReview: false, similarity: null, entry }
    }

    const normalized = normalizeItemName(name)
    if (normalized !== '') {
      // 2. normalized name
      const nameKey = nameIndex.get(normalized) ?? this.mappingNames.get(normalized)
      if (nameKey && canMerge?.(nameKey) !== false) {
        return { method: 'name', key: nameKey, needsReview: false, similarity: null, entry: null }
      }

      // 3. fuzzy name match
      let bestKey: string | null = null
      let bestSimilarity = 0
      for (const [candidate, key] of nameIndex) {
        if (candidate === '' || canMerge?.(key) === false) continue
        const similarity = diceCoefficient(normalized, candidate)
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestKey = key
        }
      }
      if (bestKey !== null && bestSimilarity >= FUZZY_THRESHOLD) {
        return {
          method: 'fuzzy',
          key: bestKey,
          needsReview: true,
          similarity: round3(bestSimilarity),
          entry: null,
        }
      }
    }

    // 4. unmapped
    return { method: 'none', key: null, needsReview: true, similarity: null, entry: null }
  }
}
