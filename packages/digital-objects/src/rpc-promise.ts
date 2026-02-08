/**
 * RpcPromise — Promise pipelining for Digital Objects
 *
 * Inspired by Cap'n Proto promise pipelining: you can access properties
 * and call methods on the result of an RPC call before it resolves.
 * Dependent operations are collected into a batch and sent as a single
 * round-trip to the remote provider.
 *
 * @example
 * ```typescript
 * // One round-trip, not two:
 * const deal = await Contact.create({ name: 'Alice' }).pipe(c =>
 *   Deal.create({ title: 'Acme', contact: c.$id })
 * )
 * ```
 */

import type { RpcPromise } from './noun-types.js'

/**
 * Create an RpcPromise<T> from a plain Promise<T> or PromiseLike<T>.
 *
 * The returned object:
 * - Is thenable (works with `await`, `.then()`, `.catch()`)
 * - Has `.pipe()` for chaining transforms without forcing resolution
 * - Supports property access that returns nested RpcPromise values
 *   (the Cap'n Proto pipelining pattern)
 *
 * Property access on the RpcPromise creates a new RpcPromise that
 * resolves to the corresponding property of the resolved value.
 * This allows expressions like:
 *
 * ```typescript
 * const rpc = createRpcPromise(fetchContact())
 * const name = await rpc.$id  // waits for contact, then extracts $id
 * ```
 *
 * @param source - The underlying promise to wrap
 * @returns An RpcPromise<T> with pipelining support
 */
export function createRpcPromise<T>(source: PromiseLike<T>): RpcPromise<T> {
  // The core implementation object with pipe and then
  const base: RpcPromise<T> = {
    pipe<U>(fn: (value: T) => U | PromiseLike<U>): RpcPromise<U> {
      const chained = source.then(fn)
      return createRpcPromise(chained)
    },

    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return source.then(onfulfilled ?? undefined, onrejected ?? undefined)
    },
  }

  // Wrap in a Proxy to support property access pipelining
  return new Proxy(base, {
    get(target, prop, receiver) {
      // Known methods on the RpcPromise interface itself
      if (prop === 'then' || prop === 'pipe') {
        return Reflect.get(target, prop, receiver)
      }

      // Symbol properties (Symbol.toPrimitive, Symbol.toStringTag, etc.)
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver)
      }

      // Property access pipelining: return a new RpcPromise that resolves
      // to the property value of the resolved parent
      const propName = prop as string
      return createRpcPromise(
        source.then((resolved) => {
          if (resolved == null) return undefined as unknown
          return (resolved as Record<string, unknown>)[propName] as unknown
        }),
      )
    },
  }) as RpcPromise<T>
}

/**
 * Check if a value is an RpcPromise (duck-typing check)
 */
export function isRpcPromise<T = unknown>(value: unknown): value is RpcPromise<T> {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as RpcPromise<T>).then === 'function' &&
    typeof (value as RpcPromise<T>).pipe === 'function'
  )
}

/**
 * Wrap a plain Promise as an RpcPromise with a transform applied to the result.
 *
 * This is the lower-level utility used by providers (like DONounProvider)
 * that need to transform raw RPC results into typed domain objects.
 *
 * @param promise - The raw promise from the transport layer
 * @param transform - Function to transform the raw result into the target type
 * @returns An RpcPromise<T> with pipelining support
 */
export function wrapRpcPromise<T>(
  promise: PromiseLike<unknown>,
  transform: (raw: unknown) => T,
): RpcPromise<T> {
  const transformed = promise.then(transform)
  return createRpcPromise(transformed)
}

// =============================================================================
// Batch Collector — groups multiple pipelined calls into one round-trip
// =============================================================================

/**
 * A pending operation in the batch queue
 */
export interface BatchOperation {
  /** The operation type */
  method: 'create' | 'get' | 'find' | 'update' | 'delete' | 'perform'
  /** Entity type name */
  type: string
  /** Arguments for the operation */
  args: unknown[]
  /** Resolve the pending promise */
  resolve: (value: unknown) => void
  /** Reject the pending promise */
  reject: (reason: unknown) => void
}

/**
 * BatchCollector groups multiple provider calls into a single batch.
 *
 * When a PipelineableNounProvider uses a BatchCollector, individual
 * create/get/update/delete/perform calls are queued instead of
 * executed immediately. The batch is flushed either:
 * - Explicitly via flush()
 * - Automatically on microtask boundary (queueMicrotask)
 *
 * The provider's executeBatch() method receives all queued operations
 * and can send them as a single RPC call.
 *
 * @example
 * ```typescript
 * const batch = new BatchCollector(async (ops) => {
 *   const results = await rpcClient.batch(ops)
 *   return results
 * })
 *
 * // These are queued, not executed immediately:
 * const p1 = batch.enqueue('create', 'Contact', [{ name: 'Alice' }])
 * const p2 = batch.enqueue('create', 'Deal', [{ title: 'Acme' }])
 *
 * // Flush sends both as a single round-trip:
 * await batch.flush()
 * const contact = await p1
 * const deal = await p2
 * ```
 */
export class BatchCollector {
  private queue: BatchOperation[] = []
  private scheduled = false

  constructor(
    private executeBatch: (operations: BatchOperation[]) => Promise<unknown[]>,
  ) {}

  /**
   * Enqueue an operation for batching.
   * Returns a promise that resolves when the batch is flushed.
   */
  enqueue(
    method: BatchOperation['method'],
    type: string,
    args: unknown[],
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ method, type, args, resolve, reject })

      // Auto-flush on microtask boundary if not already scheduled
      if (!this.scheduled) {
        this.scheduled = true
        queueMicrotask(() => this.flush())
      }
    })
  }

  /**
   * Flush all queued operations as a single batch.
   * Each operation's promise is resolved/rejected with the corresponding result.
   */
  async flush(): Promise<void> {
    this.scheduled = false
    const ops = this.queue.splice(0)
    if (ops.length === 0) return

    try {
      const results = await this.executeBatch(ops)
      for (let i = 0; i < ops.length; i++) {
        ops[i].resolve(results[i])
      }
    } catch (error) {
      for (const op of ops) {
        op.reject(error)
      }
    }
  }

  /**
   * Number of operations currently queued
   */
  get pending(): number {
    return this.queue.length
  }
}
