import { QTY_TOLERANCE } from './schema.js'

/**
 * Decimal-safe math helpers. Every quantity and NGN value produced by the
 * reconciliation engine is rounded to 3 decimal places so float drift (e.g.
 * 115.33499999999998 or 307.335) never leaks into the Reconciliation sheet.
 */

const FACTOR = 10 ** 3

/** Round to 3 decimal places, epsilon-corrected for float representation error. */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * FACTOR) / FACTOR
}

/** Sum values with intermediate 3dp rounding (keeps long sums drift-free). */
export function sum3(values: Iterable<number>): number {
  let total = 0
  for (const value of values) {
    total = round3(total + value)
  }
  return total
}

/**
 * Float-safe realization of |a - b| < tolerance for 3dp-rounded quantities.
 * All engine quantities are multiples of 0.001, so a difference strictly
 * below the tolerance means the SAME milli-unit — comparing quantized
 * integers avoids float drift (10.001 - 10 must NOT pass "< 0.001").
 */
export function qtyEquals(a: number, b: number, tolerance = QTY_TOLERANCE): boolean {
  const scale = Math.round(1 / tolerance)
  return Math.round((a + Number.EPSILON) * scale) === Math.round((b + Number.EPSILON) * scale)
}
