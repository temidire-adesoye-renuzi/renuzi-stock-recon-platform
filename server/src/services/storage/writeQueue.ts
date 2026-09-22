/**
 * WriteQueue: a single in-process promise chain. Every storage mutation is
 * enqueued here, so writes hit the workbook strictly sequentially — Excel
 * (file or Graph session) must never see interleaved writes.
 *
 * runExclusive() runs a multi-step transaction as ONE queue slot. Work that
 * the transaction itself submits (delete + append + audit) is re-entrant: it
 * executes inline instead of queueing behind its own transaction, which would
 * deadlock. Re-entrancy is scoped with AsyncLocalStorage so writes from OTHER
 * requests still queue normally behind the whole transaction.
 *
 * withRetry adds exponential backoff for transient throttling (HTTP 429/503),
 * honouring a Retry-After hint when the error carries one.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export const RETRYABLE_STATUSES = new Set([429, 503])

export interface RetryableError extends Error {
  statusCode?: number
  /** Server-provided wait hint in milliseconds (Retry-After). */
  retryAfterMs?: number
}

export function errorWithStatus(
  statusCode: number,
  message: string,
  retryAfterMs?: number
): RetryableError {
  const error = new Error(message) as RetryableError
  error.statusCode = statusCode
  if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs
  return error
}

export function errorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as { statusCode?: unknown; status?: unknown }
  for (const value of [candidate.statusCode, candidate.status]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function isRetryable(error: unknown): boolean {
  const status = errorStatus(error)
  return status !== null && RETRYABLE_STATUSES.has(status)
}

export type Sleep = (ms: number) => Promise<void>

export const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export interface RetryOptions {
  /** Total attempts including the first one. */
  maxTries?: number
  /** Delay before the 2nd attempt; doubles each retry. */
  baseDelayMs?: number
  /** Upper bound for a single backoff delay. */
  maxDelayMs?: number
  /** Injectable for tests. */
  sleep?: Sleep
}

export const DEFAULT_MAX_TRIES = 4
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_MAX_DELAY_MS = 30_000

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxTries = options.maxTries ?? DEFAULT_MAX_TRIES
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const sleep = options.sleep ?? defaultSleep

  let attempt = 0
  while (true) {
    attempt += 1
    try {
      return await operation()
    } catch (error) {
      if (attempt >= maxTries || !isRetryable(error)) throw error
      const hint = (error as RetryableError).retryAfterMs
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      const delay = typeof hint === 'number' && hint > 0 ? Math.min(hint, maxDelayMs) : backoff
      await sleep(delay)
    }
  }
}

export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve()
  /** True only within the async context of a running runExclusive(). */
  private readonly inTransaction = new AsyncLocalStorage<boolean>()

  /** Queue an operation; it runs strictly after everything before it. */
  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.inTransaction.getStore() === true) {
      // Re-entrant call from inside the running transaction: execute inline.
      // Queueing here would wait for the transaction, which waits on us.
      return operation()
    }
    const result = this.tail.then(operation, operation)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  /** Run an operation that may itself enqueue nested work (a transaction). */
  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.enqueue(() => this.inTransaction.run(true, operation))
  }
}
