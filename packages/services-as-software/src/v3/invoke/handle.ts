/**
 * InvocationHandle — the typed handle returned from `service.invoke()`
 * (per v3 §5).
 *
 * The handle is the **single seam** for state observation, clarification,
 * cancellation, and dispute on a live invocation. Every field is `readonly`
 * so callers can safely pass the handle around the customer-runtime UI
 * without worrying about mutation.
 *
 * The implementation bridges the FSM state-machine to two consumer-facing
 * shapes:
 *
 *   - `events: AsyncIterable<InvocationEvent<TOut>>` — pull-based stream a
 *     `for await` loop consumes. Backed by an internal queue so events emitted
 *     before a consumer attaches are not lost; multiple concurrent iterators
 *     are supported (each gets the full subsequent stream).
 *   - `result: Promise<TOut>` — Deferred resolved on `'delivered'`, rejected
 *     on `'failed'`. `await handle.result` is the one-shot consumer pattern.
 *
 * **Iterator-detach semantics (locked per v3 §1 changelog):** when a consumer
 * abandons their `for await`, only the subscription tears down. The
 * underlying workflow KEEPS RUNNING. This matters for billed cascades (the
 * cost has been quoted, the work continues, the result lands in the catalog
 * even if no one's watching the stream).
 *
 * @packageDocumentation
 */

import type { ClarificationResponse, InvocationEvent } from './invocation-event.js'
import type { InvocationState } from './invocation-state.js'

// ============================================================================
// Public interface
// ============================================================================

/**
 * Read-only handle the runtime returns from `service.invoke()`. Per v3 §5.
 */
export interface InvocationHandle<TOut> {
  /** Stable invocation `$id` (used by polling APIs + observability). */
  readonly id: string
  /** Current FSM state. Updates as the runtime advances the invocation. */
  readonly state: InvocationState
  /**
   * Pull-based stream of {@link InvocationEvent}s. `for await` to render the
   * customer-runtime UI; multiple concurrent iterators are supported.
   *
   * Iterator detach (consumer abandons the `for await`) is
   * **subscription-teardown only** — the underlying workflow keeps running.
   */
  readonly events: AsyncIterable<InvocationEvent<TOut>>
  /**
   * Deferred Promise resolved on the `'delivered'` event with the typed
   * payload, rejected on `'failed'` with an `Error` carrying the failure
   * reason + detail.
   */
  readonly result: Promise<TOut>

  /**
   * Reply to the most recent {@link ClarificationRequest}. Resumes the
   * cascade from `NEEDS_CLARIFICATION`.
   */
  clarify(response: ClarificationResponse): Promise<void>
  /**
   * Cancel the invocation. The FSM transitions to `CANCELLED`; cost incurred
   * up to the cancel point is still booked (refund / no-refund per
   * `RefundContract`).
   */
  cancel(reason?: string): Promise<void>
  /**
   * Mark the delivered (or accepted) result as disputed. The FSM transitions
   * `DELIVERED|ACCEPTED → DISPUTED → ESCALATED_TO_HUMAN_REVIEW`.
   */
  dispute(reason: string): Promise<void>
}

// ============================================================================
// In-memory implementation
// ============================================================================

/**
 * Minimal Deferred — exposes `resolve` / `reject` on the surrounding scope.
 * Used to back `handle.result`.
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

/**
 * Per-iterator subscription — holds a queue of pending events + one waiter
 * promise. Each `iterator()` call on `handle.events` allocates a fresh
 * subscription so concurrent consumers don't fight over the queue.
 */
interface Subscription<TOut> {
  queue: InvocationEvent<TOut>[]
  /** Pending `next()` waiters; resolved as events arrive. */
  waiters: Array<(value: IteratorResult<InvocationEvent<TOut>>) => void>
  /** True once the producer has emitted `'delivered'` or `'failed'`. */
  done: boolean
}

/**
 * In-memory {@link InvocationHandle} implementation.
 *
 * The runtime drives the handle by calling {@link emit} for each
 * {@link InvocationEvent} the FSM produces. The runtime is responsible for
 * calling `emit({ kind: 'delivered', payload })` to settle the result, or
 * `emit({ kind: 'failed', reason, detail })` to reject it.
 *
 * The handle is a **subscriber fan-out** — each call to the iterator gets its
 * own queue, so multiple UI panels can render the same invocation without
 * stealing events from each other.
 */
export class InvocationHandleImpl<TOut> implements InvocationHandle<TOut> {
  readonly id: string
  /**
   * Mutable through `emit({ kind: 'state-changed', state })`; exposed as
   * `readonly` to consumers via the {@link InvocationHandle} interface.
   */
  state: InvocationState = 'ORDERED'

  /** Active subscriptions, keyed by allocation order. */
  private readonly subs: Set<Subscription<TOut>> = new Set()

  /** Backing Deferred for `handle.result`. */
  private readonly resultDeferred = deferred<TOut>()

  /**
   * Optional hook the runtime installs to receive `clarify` / `cancel` /
   * `dispute` calls. The mock cascade walker registers a noop; the durable
   * adapter will register a real workflow signal dispatch.
   */
  onClarify?: (response: ClarificationResponse) => Promise<void>
  onCancel?: (reason?: string) => Promise<void>
  onDispute?: (reason: string) => Promise<void>

  constructor(id: string) {
    this.id = id
  }

  // ---- producer side (called by the runtime) -----------------------------

  /**
   * Push an event into every active subscription and (when terminal) settle
   * the result Deferred. Idempotent on terminal events: a second
   * `'delivered'` / `'failed'` after settlement is dropped.
   */
  emit(event: InvocationEvent<TOut>): void {
    if (event.kind === 'state-changed') {
      this.state = event.state
    }

    // Fan out to every subscription.
    for (const sub of this.subs) {
      const waiter = sub.waiters.shift()
      if (waiter) {
        waiter({ value: event, done: false })
      } else {
        sub.queue.push(event)
      }
    }

    // Settle the result Deferred on terminal events.
    if (event.kind === 'delivered') {
      this.resultDeferred.resolve(event.payload)
      this.closeAllSubscriptions()
    } else if (event.kind === 'failed') {
      const err = new Error(`invocation failed (${event.reason}): ${event.detail}`)
      ;(err as Error & { reason?: string }).reason = event.reason
      this.resultDeferred.reject(err)
      this.closeAllSubscriptions()
    }
  }

  /** Mark every subscription `done`; resolves any pending `next()` waiters. */
  private closeAllSubscriptions(): void {
    for (const sub of this.subs) {
      sub.done = true
      while (sub.waiters.length > 0) {
        const w = sub.waiters.shift()!
        w({ value: undefined, done: true })
      }
    }
  }

  // ---- consumer side (InvocationHandle surface) --------------------------

  get events(): AsyncIterable<InvocationEvent<TOut>> {
    return {
      [Symbol.asyncIterator]: () => this.createIterator(),
    }
  }

  get result(): Promise<TOut> {
    return this.resultDeferred.promise
  }

  async clarify(response: ClarificationResponse): Promise<void> {
    if (this.onClarify) await this.onClarify(response)
  }

  async cancel(reason?: string): Promise<void> {
    if (this.onCancel) await this.onCancel(reason)
  }

  async dispute(reason: string): Promise<void> {
    if (this.onDispute) await this.onDispute(reason)
  }

  // ---- iterator factory --------------------------------------------------

  private createIterator(): AsyncIterator<InvocationEvent<TOut>> {
    const sub: Subscription<TOut> = { queue: [], waiters: [], done: false }
    this.subs.add(sub)

    return {
      next: (): Promise<IteratorResult<InvocationEvent<TOut>>> => {
        if (sub.queue.length > 0) {
          const value = sub.queue.shift()!
          return Promise.resolve({ value, done: false })
        }
        if (sub.done) {
          return Promise.resolve({ value: undefined, done: true })
        }
        return new Promise<IteratorResult<InvocationEvent<TOut>>>((resolve) => {
          sub.waiters.push(resolve)
        })
      },
      return: (): Promise<IteratorResult<InvocationEvent<TOut>>> => {
        // Iterator detach (consumer abandons): subscription-teardown only.
        // The underlying workflow KEEPS RUNNING per v3 §1 changelog.
        this.subs.delete(sub)
        sub.done = true
        while (sub.waiters.length > 0) {
          const w = sub.waiters.shift()!
          w({ value: undefined, done: true })
        }
        return Promise.resolve({ value: undefined, done: true })
      },
    }
  }
}
