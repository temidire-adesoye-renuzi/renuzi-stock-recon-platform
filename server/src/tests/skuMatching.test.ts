import { describe, expect, it } from 'vitest'
import {
  FUZZY_THRESHOLD,
  SkuMatcher,
  diceCoefficient,
  normalizeItemName,
} from '../services/skuMatching.js'
import type { SkuMappingEntry } from '../services/schema.js'

const entry = (overrides: Partial<SkuMappingEntry> = {}): SkuMappingEntry => ({
  leverEdgeSkuCode: 'L1',
  leverEdgeItemName: 'LUX BAR ONE',
  xeroItemCode: 'X1',
  xeroItemName: 'LUX BAR UNO',
  csFactor: 24,
  dzFactor: 12,
  category: 'Soap',
  active: true,
  ...overrides,
})

describe('normalizeItemName', () => {
  it('uppercases, strips punctuation and collapses extra spaces', () => {
    expect(normalizeItemName(' knorr   beef--BTF14X50X8G ')).toBe('KNORR BEEF BTF14X50X8G')
    expect(normalizeItemName('CLOSE-UP Ever Fresh')).toBe('CLOSE UP EVER FRESH')
    expect(normalizeItemName('  ')).toBe('')
  })
})

describe('diceCoefficient', () => {
  it('returns 1 for identical strings and 0 for disjoint ones', () => {
    expect(diceCoefficient('ABCDEF', 'ABCDEF')).toBe(1)
    expect(diceCoefficient('AB', 'CD')).toBe(0)
    expect(diceCoefficient('AB', 'A')).toBe(0)
  })

  it('scores close variants above the fuzzy threshold', () => {
    // One-letter word variant (TRIPLE vs TRIPPLE) — well above the threshold.
    expect(
      diceCoefficient('CLOSEUP TP TRIPLE FRESH RH 264X8.5', 'CLOSEUP TP TRIPPLE FRESH RH 264X8.5')
    ).toBeGreaterThanOrEqual(FUZZY_THRESHOLD)
    // A different-size word (CHAPPAL vs BTF) falls below it — stays unmapped.
    expect(diceCoefficient('KNORR BEEF CHAPPAL 40X12X8G', 'KNORR BEEF BTF 40X12X8G')).toBeLessThan(
      FUZZY_THRESHOLD
    )
    expect(
      diceCoefficient('CLOSEUP COMPLETE FRESH 72X35G', 'SUNLIGHT DWL ORIGINAL 10X400ML')
    ).toBeLessThan(FUZZY_THRESHOLD)
  })
})

describe('SkuMatcher branches (strict order)', () => {
  it('branch 1: exact match on a mapped code (LeverEdge or Xero side)', () => {
    const matcher = new SkuMatcher([entry()])
    const byLeverEdge = matcher.match(' L1 ', 'Whatever Name', new Map())
    expect(byLeverEdge.method).toBe('code')
    expect(byLeverEdge.key).toBe('mapping:L1')
    expect(byLeverEdge.needsReview).toBe(false)
    expect(byLeverEdge.entry?.xeroItemCode).toBe('X1')

    const byXero = matcher.match('X1', 'Whatever Name', new Map())
    expect(byXero.method).toBe('code')
    expect(byXero.key).toBe('mapping:L1')
  })

  it('branch 2: normalized name match against registered items', () => {
    const matcher = new SkuMatcher([])
    const nameIndex = new Map([['CLOSEUP COMPLETE FRESH 72X35G', 'group-a']])
    const match = matcher.match('999', ' Closeup — complete   FRESH 72x35G!', nameIndex)
    expect(match.method).toBe('name')
    expect(match.key).toBe('group-a')
    expect(match.needsReview).toBe(false)
  })

  it('branch 2 also matches mapping alias names when the code is unknown', () => {
    const matcher = new SkuMatcher([entry()])
    const match = matcher.match('NEW-CODE', 'lux  bar   uno', new Map())
    expect(match.method).toBe('name')
    expect(match.key).toBe('mapping:L1')
  })

  it('branch 3: fuzzy match >= 0.85 is matched but flagged needsReview', () => {
    const matcher = new SkuMatcher([])
    const nameIndex = new Map([['CLOSEUP TP TRIPLE FRESH RH 264X8.5', 'group-b']])
    const match = matcher.match('65640762', 'CLOSEUP TP TRIPPLE FRESH RH 264X8.5', nameIndex)
    expect(match.method).toBe('fuzzy')
    expect(match.key).toBe('group-b')
    expect(match.needsReview).toBe(true)
    expect(match.similarity).toBeGreaterThanOrEqual(FUZZY_THRESHOLD)
  })

  it('branch 3 falls through to unmapped below the threshold', () => {
    const matcher = new SkuMatcher([])
    const nameIndex = new Map([['SUNLIGHT DWL ORIGINAL 10X400ML', 'group-c']])
    const match = matcher.match('1', 'TGI BIG BULL RICE 2.25KG', nameIndex)
    expect(match.method).toBe('none')
    expect(match.key).toBeNull()
    expect(match.needsReview).toBe(true)
  })

  it('branch 4: unmapped when nothing matches', () => {
    const matcher = new SkuMatcher([])
    const match = matcher.match('ZZZ', 'TOTALLY UNKNOWN ITEM', new Map())
    expect(match.method).toBe('none')
    expect(match.key).toBeNull()
    expect(match.needsReview).toBe(true)
  })

  it('ignores inactive mapping entries', () => {
    const matcher = new SkuMatcher([entry({ active: false })])
    const match = matcher.match('X1', 'LUX BAR UNO', new Map())
    expect(match.method).toBe('none')
  })

  it('respects the merge guard (same-source groups are never merged)', () => {
    const matcher = new SkuMatcher([])
    const nameIndex = new Map([
      ['CLOSEUP COMPLETE FRESH 72X35G', 'group-a'],
      ['CLOSEUP COMPLETE FRESH 72X35G RC PROMO', 'group-promo'],
    ])
    const blocked = (): boolean => false
    const exact = matcher.match('1', 'Closeup Complete Fresh 72X35G', nameIndex, blocked)
    expect(exact.method).toBe('none')
    const fuzzy = matcher.match('2', 'Closeup Complete Fresh 72X35G RC PROMO!', nameIndex, blocked)
    expect(fuzzy.method).toBe('none')
  })
})
