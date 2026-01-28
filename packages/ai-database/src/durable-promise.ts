/**
 * Durable Promise - Promise-like wrapper around database Actions
 *
 * Time is an implementation detail. Whether an operation takes 10ms or 10 hours,
 * the same code works. The DurablePromise persists its state as an Action,
 * allowing crash recovery, observability, and time-agnostic execution.
 *
 * @packageDocumentation
 */

import type { Action, MemoryProvider } from './memory-provider.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Execution priority tiers
 *
 * - priority: Pay more for immediate execution (fastest, highest cost)
 * - standard: Normal price/latency tradeoff (default)
 * - flex: Discount for variable latency (cost savings)
 * - batch: Maximum discount, 24h SLA (50% savings)
 */
export type ExecutionPriority = 'priority' | 'standard' | 'flex' | 'batch'

/**
 * Options for creating a DurablePromise
 */
export interface DurablePromiseOptions<T = unknown> {
  /** Method identifier (e.g., 'ai.generate', 'db.get', 'api.fetch') */
  method: string

  /** Arguments passed to the method */
  args?: unknown[]

  /** The executor function that performs the actual work */
  executor: () => Promise<T>

  /** Execution priority tier (defaults to context or 'standard') */
  priority?: ExecutionPriority

  /** Concurrency key for queue grouping */
  concurrencyKey?: string

  /** Defer execution until this time (for batch windows) */
  deferUntil?: Date

  /** Action IDs this promise depends on (must complete first) */
  dependsOn?: string[]

  /** Actor identifier (who initiated this operation) */
  actor?: string

  /** Additional metadata */
  meta?: Record<string, unknown>

  /** Provider instance (if not using context) */
  provider?: MemoryProvider
}

/**
 * Result of DurablePromise resolution
 */
export interface DurablePromiseResult<T> {
  /** The resolved value */
  value: T
  /** The underlying Action record */
  action: Action
  /** Total execution time in ms */
  duration: number
}

/**
 * Internal state for promise resolution
 */
interface PromiseState<T> {
  status: 'pending' | 'resolved' | 'rejected'
  value?: T
  error?: Error
  resolvers: Array<{
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
  }>
}

// =============================================================================
// Context Stack (for inheriting priority from workflow)
// =============================================================================

interface ExecutionContext {
  priority: ExecutionPriority
  provider?: MemoryProvider
  concurrencyKey?: string
  actor?: string
  batchWindow?: number
  onFlush?: () => Promise<void>
}

const contextStack: ExecutionContext[] = []

/**
 * Get the current execution context
 */
export function getCurrentContext(): ExecutionContext | undefined {
  return contextStack[contextStack.length - 1]
}

/**
 * Run code within an execution context
 */
export async function withContext<T>(
  context: Partial<ExecutionContext>,
  fn: () => Promise<T>
): Promise<T> {
  const parent = getCurrentContext()
  const merged: ExecutionContext = {
    priority: context.priority ?? parent?.priority ?? 'standard',
  }
  const provider = context.provider ?? parent?.provider
  if (provider !== undefined) merged.provider = provider
  const concurrencyKey = context.concurrencyKey ?? parent?.concurrencyKey
  if (concurrencyKey !== undefined) merged.concurrencyKey = concurrencyKey
  const actor = context.actor ?? parent?.actor
  if (actor !== undefined) merged.actor = actor
  const batchWindow = context.batchWindow ?? parent?.batchWindow
  if (batchWindow !== undefined) merged.batchWindow = batchWindow
  const onFlush = context.onFlush ?? parent?.onFlush
  if (onFlush !== undefined) merged.onFlush = onFlush

  contextStack.push(merged)
  try {
    return await fn()
  } finally {
    contextStack.pop()
  }
}

/**
 * Set global default context
 */
export function setDefaultContext(context: Partial<ExecutionContext>): void {
  if (contextStack.length === 0) {
    const newContext: ExecutionContext = {
      priority: context.priority ?? 'standard',
    }
    if (context.provider !== undefined) newContext.provider = context.provider
    if (context.concurrencyKey !== undefined) newContext.concurrencyKey = context.concurrencyKey
    if (context.actor !== undefined) newContext.actor = context.actor
    if (context.batchWindow !== undefined) newContext.batchWindow = context.batchWindow
    if (context.onFlush !== undefined) newContext.onFlush = context.onFlush
    contextStack.push(newContext)
  } else {
    Object.assign(contextStack[0]!, context)
  }
}

// =============================================================================
// DurablePromise Class
// =============================================================================

/** Symbol to identify DurablePromise instances */
export const DURABLE_PROMISE_SYMBOL = Symbol.for('ai-database.DurablePromise')

/**
 * A Promise-like class that persists its state as an Action
 *
 * @example
 * ```ts
 * const promise = new DurablePromise({
 *   method: 'ai.generate',
 *   args: [{ prompt: 'Hello' }],
 *   executor: async () => await ai.generate({ prompt: 'Hello' }),
 *   priority: 'batch',
 * })
 *
 * // Access the underlying action
 * console.log(promise.actionId)
 *
 * // Await like a normal promise
 * const result = await promise
 * ```
 */
export class DurablePromise<T> implements PromiseLike<T> {
  readonly [DURABLE_PROMISE_SYMBOL] = true

  /** The Action ID backing this promise */
  readonly actionId: string

  /** The method being executed */
  readonly method: string

  /** The execution priority */
  readonly priority: ExecutionPriority

  /** Dependencies that must complete first */
  readonly dependsOn: string[]

  private readonly state: PromiseState<T> = {
    status: 'pending',
    resolvers: [],
  }

  private action: Action | null = null
  private provider: MemoryProvider | null = null
  private executor: (() => Promise<T>) | null = null
  private startTime: number = Date.now()

  constructor(options: DurablePromiseOptions<T>) {
    const context = getCurrentContext()

    this.method = options.method
    this.priority = options.priority ?? context?.priority ?? 'standard'
    this.dependsOn = options.dependsOn ?? []
    this.provider = options.provider ?? context?.provider ?? null
    this.executor = options.executor
    this.actionId = crypto.randomUUID()

    // Create the action immediately if we have a provider
    if (this.provider) {
      this.initializeAction(options)
    } else {
      // Defer action creation but start execution
      this.executeDirectly()
    }
  }

  private async initializeAction(options: DurablePromiseOptions<T>): Promise<void> {
    if (!this.provider) return

    try {
      // Create the action record
      const actionOptions: Parameters<MemoryProvider['createAction']>[0] = {
        actor: options.actor ?? getCurrentContext()?.actor ?? 'system',
        action: this.parseActionVerb(this.method),
        object: this.method,
        objectData: {
          method: this.method,
          args: options.args,
          priority: this.priority,
          concurrencyKey: options.concurrencyKey,
          deferUntil: options.deferUntil?.toISOString(),
          dependsOn: this.dependsOn,
        },
      }
      if (options.meta !== undefined) {
        actionOptions.meta = options.meta
      }
      this.action = await this.provider.createAction(actionOptions)

      // Override the generated ID with our pre-generated one
      // (This allows us to return actionId synchronously)
      ;(this.action as { id: string }).id = this.actionId

      // Check if we should defer execution
      if (this.priority === 'batch') {
        // Register with the batch scheduler instead of executing immediately
        const scheduler = getBatchScheduler()
        if (scheduler) {
          scheduler.enqueue(this as DurablePromise<unknown>)
          return
        }
      }

      // Check dependencies
      if (this.dependsOn.length > 0) {
        await this.waitForDependencies()
      }

      // Execute
      await this.execute()
    } catch (error) {
      this.reject(error as Error)
    }
  }

  private parseActionVerb(method: string): string {
    // Extract verb from method like 'ai.generate' -> 'generate'
    const parts = method.split('.')
    return parts[parts.length - 1] || 'process'
  }

  private async waitForDependencies(): Promise<void> {
    if (!this.provider || this.dependsOn.length === 0) return

    // Poll for dependency completion
    const checkInterval = 100 // ms
    const maxWait = 24 * 60 * 60 * 1000 // 24 hours

    const startWait = Date.now()

    while (Date.now() - startWait < maxWait) {
      const pending = await this.provider.listActions({
        status: 'pending',
      })

      const active = await this.provider.listActions({
        status: 'active',
      })

      const blockedBy = [...pending, ...active]
        .filter((a) => this.dependsOn.includes(a.id))
        .map((a) => a.id)

      if (blockedBy.length === 0) {
        // All dependencies resolved
        return
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error(`Timeout waiting for dependencies: ${this.dependsOn.join(', ')}`)
  }

  private async execute(): Promise<void> {
    if (!this.executor) {
      throw new Error('No executor provided')
    }

    try {
      // Mark as active
      if (this.provider && this.action) {
        await this.provider.updateAction(this.actionId, { status: 'active' })
      }

      // Execute the actual work
      const result = await this.executor()

      // Mark as completed
      if (this.provider && this.action) {
        await this.provider.updateAction(this.actionId, {
          status: 'completed',
          result: { value: result as unknown as Record<string, unknown> },
        })
      }

      this.resolve(result)
    } catch (error) {
      // Mark as failed
      if (this.provider && this.action) {
        await this.provider.updateAction(this.actionId, {
          status: 'failed',
          error: (error as Error).message,
        })
      }

      this.reject(error as Error)
    }
  }

  private async executeDirectly(): Promise<void> {
    if (!this.executor) {
      throw new Error('No executor provided')
    }

    try {
      const result = await this.executor()
      this.resolve(result)
    } catch (error) {
      this.reject(error as Error)
    }
  }

  private resolve(value: T): void {
    if (this.state.status !== 'pending') return

    this.state.status = 'resolved'
    this.state.value = value

    for (const { resolve } of this.state.resolvers) {
      resolve(value)
    }
    this.state.resolvers = []
  }

  private reject(error: Error): void {
    if (this.state.status !== 'pending') return

    this.state.status = 'rejected'
    this.state.error = error

    for (const { reject } of this.state.resolvers) {
      reject(error)
    }
    this.state.resolvers = []
  }

  /**
   * Implement PromiseLike interface
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return new Promise<TResult1 | TResult2>((resolve, reject) => {
      const handleResolve = (value: T) => {
        if (onfulfilled) {
          try {
            resolve(onfulfilled(value))
          } catch (e) {
            reject(e)
          }
        } else {
          resolve(value as unknown as TResult1)
        }
      }

      const handleReject = (error: unknown) => {
        if (onrejected) {
          try {
            resolve(onrejected(error))
          } catch (e) {
            reject(e)
          }
        } else {
          reject(error)
        }
      }

      if (this.state.status === 'resolved') {
        handleResolve(this.state.value!)
      } else if (this.state.status === 'rejected') {
        handleReject(this.state.error)
      } else {
        this.state.resolvers.push({
          resolve: handleResolve as (value: T | PromiseLike<T>) => void,
          reject: handleReject,
        })
      }
    })
  }

  /**
   * Catch handler
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.then(null, onrejected)
  }

  /**
   * Finally handler
   */
  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.then(
      (value) => {
        onfinally?.()
        return value
      },
      (reason) => {
        onfinally?.()
        throw reason
      }
    )
  }

  /**
   * Get the current status
   */
  get status(): Action['status'] {
    if (this.action) return this.action.status
    if (this.state.status === 'resolved') return 'completed'
    if (this.state.status === 'rejected') return 'failed'
    return 'pending'
  }

  /**
   * Get the underlying Action (if available)
   */
  async getAction(): Promise<Action | null> {
    if (this.action) return this.action
    if (!this.provider) return null
    return this.provider.getAction(this.actionId)
  }

  /**
   * Get the result with full metadata
   */
  async getResult(): Promise<DurablePromiseResult<T>> {
    const value = await this
    const action = await this.getAction()

    return {
      value,
      action: action!,
      duration: Date.now() - this.startTime,
    }
  }

  /**
   * Cancel the promise if still pending
   */
  async cancel(): Promise<void> {
    if (this.state.status !== 'pending') {
      throw new Error('Cannot cancel a resolved or rejected promise')
    }

    if (this.provider) {
      await this.provider.cancelAction(this.actionId)
    }

    this.reject(new Error('Promise cancelled'))
  }

  /**
   * Retry a failed promise
   */
  async retry(): Promise<this> {
    if (this.state.status !== 'rejected') {
      throw new Error('Can only retry failed promises')
    }

    if (this.provider) {
      await this.provider.retryAction(this.actionId)
    }

    // Re-execute
    this.state.status = 'pending'
    await this.execute()
    return this
  }
}

/**
 * Check if a value is a DurablePromise
 */
export function isDurablePromise(value: unknown): value is DurablePromise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    DURABLE_PROMISE_SYMBOL in value &&
    (value as Record<symbol, unknown>)[DURABLE_PROMISE_SYMBOL] === true
  )
}

/**
 * Create a durable promise from an executor function
 */
export function durable<T>(
  method: string,
  executor: () => Promise<T>,
  options?: Omit<DurablePromiseOptions<T>, 'method' | 'executor'>
): DurablePromise<T> {
  return new DurablePromise({
    method,
    executor,
    ...options,
  })
}

// =============================================================================
// Batch Scheduler Singleton
// =============================================================================

let batchScheduler: BatchScheduler | null = null

/**
 * Get the global batch scheduler
 */
export function getBatchScheduler(): BatchScheduler | null {
  return batchScheduler
}

/**
 * Set the global batch scheduler
 */
export function setBatchScheduler(scheduler: BatchScheduler | null): void {
  batchScheduler = scheduler
}

// =============================================================================
// BatchScheduler Interface (implemented in execution-queue.ts)
// =============================================================================

/**
 * Interface for batch scheduling
 * Full implementation is in execution-queue.ts
 */
export interface BatchScheduler {
  /** Add a promise to the batch queue */
  enqueue(promise: DurablePromise<unknown>): void

  /** Flush all pending batches */
  flush(): Promise<void>

  /** Get count of pending promises */
  readonly pending: number
}
