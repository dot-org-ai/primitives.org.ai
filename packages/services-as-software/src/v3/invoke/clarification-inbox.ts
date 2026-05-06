/**
 * ClarificationInbox — per-invocation rendezvous between the cascade walker
 * (producer side) and the {@link InvocationHandle.clarify} call (consumer
 * side).
 *
 * The walker, on a Human FunctionRef step, registers a {@link Deferred} keyed
 * by the {@link ClarificationRequest.id} and awaits it. The handle, on
 * `clarify(response)`, resolves the matching Deferred so the walker can
 * resume and use the response payload as the cascade's `carry` value.
 *
 * Round-8 status: in-memory only. Lives for the lifetime of the
 * {@link InvocationHandleImpl} and is dropped when the invocation settles.
 *
 * TODO(round 9+): a durable adapter will replace this Map with a
 * workflow-signal park/resume mechanism (CF Workflows + ai-workflows
 * `DurableExecutionAdapter`), so the dwell timer becomes the configured
 * NEEDS_CLARIFICATION cap (per ADR-0008: 30 days). The 30-second cap below
 * is a *mock* tunable suited to the in-memory walker only; production code
 * paths must NOT use this cap.
 *
 * @packageDocumentation
 */

import type { ClarificationResponse } from './invocation-event.js'

// ============================================================================
// Tunables
// ============================================================================

/**
 * In-memory dwell cap for the mock walker — 30 seconds. ADR-0008 caps
 * production NEEDS_CLARIFICATION at 30 *days*; this short cap exists so
 * test runs and developer ergonomics don't block on a missing reply.
 *
 * TODO(round 9): make this a per-invocation tunable read from
 * {@link InvokeOpts}, with the production default = 30 days.
 */
export const MOCK_CLARIFICATION_DWELL_MS = 30_000

// ============================================================================
// Deferred — minimal Promise + resolve handle
// ============================================================================

/**
 * Internal Deferred shape — `resolve` exposed to the registrar so the inbox
 * can settle the Promise from outside the executor.
 */
interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// ============================================================================
// Inbox
// ============================================================================

/**
 * Per-invocation clarification rendezvous. The walker `register`s a request
 * id and `await`s the returned Promise; the handle `deliver`s a response,
 * settling the matching Promise.
 *
 * Unmatched responses (the handle delivered a `requestId` the walker never
 * registered, or the walker already resumed/timed out) are silently dropped:
 * the handle's `clarify()` resolves regardless so the caller's UI does not
 * block on stale replies.
 */
export class ClarificationInbox {
  private readonly pending: Map<string, Deferred<ClarificationResponse>> = new Map()

  /**
   * Walker side: register a request id and receive a Promise that resolves
   * when the matching {@link ClarificationResponse} arrives via
   * {@link deliver}, or rejects when the dwell timer expires.
   *
   * Caller is responsible for cleaning up via {@link forget} on resume or
   * timeout — `await` semantics make this easy with a `try/finally`.
   */
  register(
    requestId: string,
    dwellMs: number = MOCK_CLARIFICATION_DWELL_MS
  ): Promise<ClarificationResponse> {
    const d = deferred<ClarificationResponse>()
    this.pending.set(requestId, d)

    // Race the response against the dwell timer. On timeout, reject with a
    // sentinel error the walker translates to a typed `'failed'` event.
    const timer = setTimeout(() => {
      // Only reject if the request is still pending (not already resolved).
      const still = this.pending.get(requestId)
      if (still === d) {
        this.pending.delete(requestId)
        d.reject(new ClarificationTimeoutError(requestId, dwellMs))
      }
    }, dwellMs)

    // Best-effort cleanup of the timer when the Promise settles either way.
    d.promise
      .finally(() => clearTimeout(timer))
      .catch(() => {
        // swallowed — we're only here to clear the timer
      })

    return d.promise
  }

  /**
   * Handle side: deliver a response to a registered request. Returns `true`
   * if a matching pending request was found and resolved; `false` if the id
   * was unknown (caller already resumed, timed out, or replied twice).
   */
  deliver(response: ClarificationResponse): boolean {
    const d = this.pending.get(response.requestId)
    if (!d) return false
    this.pending.delete(response.requestId)
    d.resolve(response)
    return true
  }

  /**
   * Drop a pending registration without resolving. Used by the walker on
   * its own timeout/resume path so a late `deliver` becomes a no-op.
   */
  forget(requestId: string): void {
    this.pending.delete(requestId)
  }
}

/**
 * Sentinel error thrown by {@link ClarificationInbox.register} when the
 * dwell timer expires. The walker catches this and emits a typed
 * `'failed'` event with `reason: 'timeout'`.
 */
export class ClarificationTimeoutError extends Error {
  readonly requestId: string
  readonly dwellMs: number
  constructor(requestId: string, dwellMs: number) {
    super(`Clarification dwell exceeded ${dwellMs}ms — caller did not respond`)
    this.name = 'ClarificationTimeoutError'
    this.requestId = requestId
    this.dwellMs = dwellMs
  }
}
