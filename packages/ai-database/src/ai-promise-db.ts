/**
 * AIPromise Database Layer
 *
 * Brings promise pipelining, destructuring schema inference, and batch
 * processing to database operations—just like ai-functions.
 *
 * @example
 * ```ts
 * // Chain without await
 * const leads = db.Lead.list()
 * const enriched = await leads.map(lead => ({
 *   lead,
 *   customer: lead.customer,        // Batch loaded
 *   orders: lead.customer.orders,   // Batch loaded
 * }))
 *
 * // Destructure for projections
 * const { name, email } = await db.Lead.first()
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/** Symbol to identify DBPromise instances */
export const DB_PROMISE_SYMBOL = Symbol.for('db-promise')

/** Symbol to get raw promise */
export const RAW_DB_PROMISE_SYMBOL = Symbol.for('db-promise-raw')

/** Dependency for batch loading */
interface DBDependency {
  type: string
  ids: string[]
  relation?: string
}

/** Options for DBPromise creation */
export interface DBPromiseOptions<T> {
  /** The entity type */
  type?: string
  /** Parent promise (for relationship chains) */
  parent?: DBPromise<unknown>
  /** Property path from parent */
  propertyPath?: string[]
  /** Executor function */
  executor: () => Promise<T>
  /** Batch context for .map() */
  batchContext?: BatchContext
}

/** Batch context for recording map operations */
interface BatchContext {
  items: unknown[]
  recordings: Map<string, PropertyRecording>
}

/** Recording of property accesses */
interface PropertyRecording {
  paths: Set<string>
  relations: Map<string, RelationRecording>
}

/** Recording of relation accesses */
interface RelationRecording {
  type: string
  isArray: boolean
  nestedPaths: Set<string>
}

// =============================================================================
// ForEach Types - For large-scale, slow operations
// =============================================================================

/**
 * Progress info for forEach operations
 */
export interface ForEachProgress {
  /** Current item index (0-based) */
  index: number
  /** Total items (if known) */
  total?: number
  /** Number of items completed */
  completed: number
  /** Number of items failed */
  failed: number
  /** Number of items skipped */
  skipped: number
  /** Current item being processed */
  current?: unknown
  /** Elapsed time in ms */
  elapsed: number
  /** Estimated time remaining in ms (if total known) */
  remaining?: number
  /** Items per second */
  rate: number
}

/**
 * Error handling result
 */
export type ForEachErrorAction = 'continue' | 'retry' | 'skip' | 'stop'

/**
 * Options for forEach operations
 *
 * @example
 * ```ts
 * await db.Lead.list().forEach(async lead => {
 *   const analysis = await ai`analyze ${lead}`
 *   await db.Lead.update(lead.$id, { analysis })
 * }, {
 *   concurrency: 10,
 *   onProgress: p => console.log(`${p.completed}/${p.total}`),
 *   onError: (err, item) => err.retryable ? 'retry' : 'continue',
 * })
 * ```
 */
export interface ForEachOptions<T = unknown> {
  /**
   * Maximum concurrent operations (default: 1)
   * Set higher for I/O-bound operations, lower for CPU-bound
   */
  concurrency?: number

  /**
   * Batch size for fetching items (default: 100)
   * Helps with memory efficiency for large datasets
   */
  batchSize?: number

  /**
   * Maximum retries per item (default: 0)
   */
  maxRetries?: number

  /**
   * Delay between retries in ms (default: 1000)
   * Can be a number or function for exponential backoff
   */
  retryDelay?: number | ((attempt: number) => number)

  /**
   * Progress callback - called after each item completes
   */
  onProgress?: (progress: ForEachProgress) => void

  /**
   * Error handler - determines what to do on failure
   * - 'continue': Skip item and continue (default)
   * - 'retry': Retry the item (up to maxRetries)
   * - 'skip': Mark as skipped and continue
   * - 'stop': Stop processing immediately
   */
  onError?: ForEachErrorAction | ((error: Error, item: T, attempt: number) => ForEachErrorAction | Promise<ForEachErrorAction>)

  /**
   * Called when an item completes successfully
   */
  onComplete?: (item: T, result: unknown, index: number) => void | Promise<void>

  /**
   * AbortController signal for cancellation
   */
  signal?: AbortSignal

  /**
   * Timeout per item in ms (default: none)
   */
  timeout?: number
}

/**
 * Result of forEach operation
 */
export interface ForEachResult {
  /** Total items processed */
  total: number
  /** Items completed successfully */
  completed: number
  /** Items that failed */
  failed: number
  /** Items skipped */
  skipped: number
  /** Total elapsed time in ms */
  elapsed: number
  /** Errors encountered (if any) */
  errors: Array<{ item: unknown; error: Error; index: number }>
  /** Was the operation cancelled? */
  cancelled: boolean
}

// =============================================================================
// DBPromise Implementation
// =============================================================================

/**
 * DBPromise - Promise pipelining for database operations
 *
 * Like AIPromise but for database queries. Enables:
 * - Property access tracking for projections
 * - Batch relationship loading
 * - .map() for processing arrays efficiently
 */
export class DBPromise<T> implements PromiseLike<T> {
  readonly [DB_PROMISE_SYMBOL] = true

  private _options: DBPromiseOptions<T>
  private _accessedProps = new Set<string>()
  private _propertyPath: string[]
  private _parent: DBPromise<unknown> | null
  private _resolver: Promise<T> | null = null
  private _resolvedValue: T | undefined
  private _isResolved = false
  private _pendingRelations = new Map<string, DBDependency>()

  constructor(options: DBPromiseOptions<T>) {
    this._options = options
    this._propertyPath = options.propertyPath || []
    this._parent = options.parent || null

    // Return proxy for property tracking
    return new Proxy(this, DB_PROXY_HANDLERS) as DBPromise<T>
  }

  /** Get accessed properties */
  get accessedProps(): Set<string> {
    return this._accessedProps
  }

  /** Get property path */
  get path(): string[] {
    return this._propertyPath
  }

  /** Check if resolved */
  get isResolved(): boolean {
    return this._isResolved
  }

  /**
   * Resolve this promise
   */
  async resolve(): Promise<T> {
    if (this._isResolved) {
      return this._resolvedValue as T
    }

    // If this is a property access on parent, resolve parent first
    if (this._parent && this._propertyPath.length > 0) {
      const parentValue = await this._parent.resolve()
      const value = getNestedValue(parentValue, this._propertyPath)
      this._resolvedValue = value as T
      this._isResolved = true
      return this._resolvedValue
    }

    // Execute the query
    const result = await this._options.executor()
    this._resolvedValue = result
    this._isResolved = true

    return this._resolvedValue
  }

  /**
   * Map over array results with batch optimization
   *
   * @example
   * ```ts
   * const customers = db.Customer.list()
   * const withOrders = await customers.map(customer => ({
   *   name: customer.name,
   *   orders: customer.orders,      // Batch loaded!
   *   total: customer.orders.length,
   * }))
   * ```
   */
  map<U>(
    callback: (item: DBPromise<T extends (infer I)[] ? I : T>, index: number) => U
  ): DBPromise<U[]> {
    const parentPromise = this

    return new DBPromise<U[]>({
      type: this._options.type,
      executor: async () => {
        // Resolve the parent array
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          throw new Error('Cannot map over non-array result')
        }

        // Create recording context
        const recordings: PropertyRecording[] = []

        // Record what the callback accesses for each item
        const recordedResults: U[] = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const recording: PropertyRecording = {
            paths: new Set(),
            relations: new Map(),
          }

          // Create a recording proxy for this item
          const recordingProxy = createRecordingProxy(item, recording)

          // Execute callback with recording proxy
          const result = callback(recordingProxy as any, i)
          recordedResults.push(result)
          recordings.push(recording)
        }

        // Analyze recordings to find batch-loadable relations
        const batchLoads = analyzeBatchLoads(recordings, items)

        // Execute batch loads
        const loadedRelations = await executeBatchLoads(batchLoads)

        // Apply loaded relations to results
        return applyBatchResults(recordedResults, loadedRelations, items)
      },
    })
  }

  /**
   * Filter results
   */
  filter(
    predicate: (item: T extends (infer I)[] ? I : T, index: number) => boolean
  ): DBPromise<T> {
    const parentPromise = this

    return new DBPromise<T>({
      type: this._options.type,
      executor: async () => {
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          return items
        }
        return items.filter(predicate as any) as T
      },
    })
  }

  /**
   * Sort results
   */
  sort(
    compareFn?: (a: T extends (infer I)[] ? I : T, b: T extends (infer I)[] ? I : T) => number
  ): DBPromise<T> {
    const parentPromise = this

    return new DBPromise<T>({
      type: this._options.type,
      executor: async () => {
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          return items
        }
        return [...items].sort(compareFn as any) as T
      },
    })
  }

  /**
   * Limit results
   */
  limit(n: number): DBPromise<T> {
    const parentPromise = this

    return new DBPromise<T>({
      type: this._options.type,
      executor: async () => {
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          return items
        }
        return items.slice(0, n) as T
      },
    })
  }

  /**
   * Get first item
   */
  first(): DBPromise<T extends (infer I)[] ? I | null : T> {
    const parentPromise = this

    return new DBPromise({
      type: this._options.type,
      executor: async () => {
        const items = await parentPromise.resolve()
        if (Array.isArray(items)) {
          return items[0] ?? null
        }
        return items
      },
    }) as DBPromise<T extends (infer I)[] ? I | null : T>
  }

  /**
   * Process each item with concurrency control, progress tracking, and error handling
   *
   * Designed for large-scale operations like AI generations or workflows.
   *
   * @example
   * ```ts
   * // Simple - process sequentially
   * await db.Lead.list().forEach(async lead => {
   *   await processLead(lead)
   * })
   *
   * // With concurrency and progress
   * await db.Lead.list().forEach(async lead => {
   *   const analysis = await ai`analyze ${lead}`
   *   await db.Lead.update(lead.$id, { analysis })
   * }, {
   *   concurrency: 10,
   *   onProgress: p => console.log(`${p.completed}/${p.total} (${p.rate}/s)`),
   * })
   *
   * // With error handling and retries
   * const result = await db.Order.list().forEach(async order => {
   *   await sendInvoice(order)
   * }, {
   *   concurrency: 5,
   *   maxRetries: 3,
   *   retryDelay: attempt => 1000 * Math.pow(2, attempt),
   *   onError: (err, order) => err.code === 'RATE_LIMIT' ? 'retry' : 'continue',
   * })
   *
   * console.log(`Sent ${result.completed}, failed ${result.failed}`)
   * ```
   */
  async forEach<U>(
    callback: (item: T extends (infer I)[] ? I : T, index: number) => U | Promise<U>,
    options: ForEachOptions<T extends (infer I)[] ? I : T> = {}
  ): Promise<ForEachResult> {
    const {
      concurrency = 1,
      batchSize = 100,
      maxRetries = 0,
      retryDelay = 1000,
      onProgress,
      onError = 'continue',
      onComplete,
      signal,
      timeout,
    } = options

    const startTime = Date.now()
    const errors: ForEachResult['errors'] = []
    let completed = 0
    let failed = 0
    let skipped = 0
    let cancelled = false

    // Resolve the items
    const items = await this.resolve()
    if (!Array.isArray(items)) {
      throw new Error('forEach can only be called on array results')
    }

    const total = items.length

    // Helper to calculate progress
    const getProgress = (index: number, current?: unknown): ForEachProgress => {
      const elapsed = Date.now() - startTime
      const processed = completed + failed + skipped
      const rate = processed > 0 ? (processed / elapsed) * 1000 : 0
      const remaining = rate > 0 && total ? ((total - processed) / rate) * 1000 : undefined

      return {
        index,
        total,
        completed,
        failed,
        skipped,
        current,
        elapsed,
        remaining,
        rate,
      }
    }

    // Helper to get retry delay
    const getRetryDelay = (attempt: number): number => {
      return typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay
    }

    // Helper to handle error
    const handleError = async (
      error: Error,
      item: unknown,
      attempt: number
    ): Promise<ForEachErrorAction> => {
      if (typeof onError === 'function') {
        return onError(error, item as any, attempt)
      }
      return onError
    }

    // Process a single item with retries
    const processItem = async (item: unknown, index: number): Promise<void> => {
      if (cancelled || signal?.aborted) {
        cancelled = true
        return
      }

      let attempt = 0
      while (true) {
        try {
          // Create timeout wrapper if needed
          let result: U
          if (timeout) {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
            })
            result = await Promise.race([
              Promise.resolve(callback(item as any, index)),
              timeoutPromise,
            ])
          } else {
            result = await callback(item as any, index)
          }

          // Success
          completed++
          await onComplete?.(item as any, result, index)
          onProgress?.(getProgress(index, item))
          return

        } catch (error) {
          attempt++
          const action = await handleError(error as Error, item, attempt)

          switch (action) {
            case 'retry':
              if (attempt <= maxRetries) {
                await sleep(getRetryDelay(attempt))
                continue // Retry
              }
              // Fall through to continue if max retries exceeded
              failed++
              errors.push({ item, error: error as Error, index })
              onProgress?.(getProgress(index, item))
              return

            case 'skip':
              skipped++
              onProgress?.(getProgress(index, item))
              return

            case 'stop':
              failed++
              errors.push({ item, error: error as Error, index })
              cancelled = true
              return

            case 'continue':
            default:
              failed++
              errors.push({ item, error: error as Error, index })
              onProgress?.(getProgress(index, item))
              return
          }
        }
      }
    }

    // Process items with concurrency
    if (concurrency === 1) {
      // Sequential processing
      for (let i = 0; i < items.length; i++) {
        if (cancelled || signal?.aborted) {
          cancelled = true
          break
        }
        await processItem(items[i], i)
      }
    } else {
      // Concurrent processing with semaphore
      const semaphore = new Semaphore(concurrency)
      const promises: Promise<void>[] = []

      for (let i = 0; i < items.length; i++) {
        if (cancelled || signal?.aborted) {
          cancelled = true
          break
        }

        const itemIndex = i
        const item = items[i]

        promises.push(
          semaphore.acquire().then(async (release) => {
            try {
              await processItem(item, itemIndex)
            } finally {
              release()
            }
          })
        )
      }

      await Promise.all(promises)
    }

    return {
      total,
      completed,
      failed,
      skipped,
      elapsed: Date.now() - startTime,
      errors,
      cancelled,
    }
  }

  /**
   * Async iteration
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T extends (infer I)[] ? I : T> {
    const items = await this.resolve()
    if (Array.isArray(items)) {
      for (const item of items) {
        yield item as any
      }
    } else {
      yield items as any
    }
  }

  /**
   * Promise interface - then()
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (!this._resolver) {
      this._resolver = new Promise<T>((resolve, reject) => {
        queueMicrotask(async () => {
          try {
            const value = await this.resolve()
            resolve(value)
          } catch (error) {
            reject(error)
          }
        })
      })
    }

    return this._resolver.then(onfulfilled, onrejected)
  }

  /**
   * Promise interface - catch()
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.then(null, onrejected)
  }

  /**
   * Promise interface - finally()
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
}

// =============================================================================
// Proxy Handlers
// =============================================================================

const DB_PROXY_HANDLERS: ProxyHandler<DBPromise<unknown>> = {
  get(target, prop: string | symbol, receiver) {
    // Handle symbols
    if (typeof prop === 'symbol') {
      if (prop === DB_PROMISE_SYMBOL) return true
      if (prop === RAW_DB_PROMISE_SYMBOL) return target
      if (prop === Symbol.asyncIterator) return target[Symbol.asyncIterator].bind(target)
      return (target as any)[prop]
    }

    // Handle promise methods
    if (prop === 'then' || prop === 'catch' || prop === 'finally') {
      return (target as any)[prop].bind(target)
    }

    // Handle DBPromise methods
    if (['map', 'filter', 'sort', 'limit', 'first', 'forEach', 'resolve'].includes(prop)) {
      return (target as any)[prop].bind(target)
    }

    // Handle internal properties
    if (prop.startsWith('_') || ['accessedProps', 'path', 'isResolved'].includes(prop)) {
      return (target as any)[prop]
    }

    // Track property access
    target.accessedProps.add(prop)

    // Return a new DBPromise for the property path
    return new DBPromise<unknown>({
      type: target['_options']?.type,
      parent: target,
      propertyPath: [...target.path, prop],
      executor: async () => {
        const parentValue = await target.resolve()
        return getNestedValue(parentValue, [prop])
      },
    })
  },

  set() {
    throw new Error('DBPromise properties are read-only')
  },

  deleteProperty() {
    throw new Error('DBPromise properties cannot be deleted')
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--
      return () => this.release()
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.permits--
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.permits++
    const next = this.queue.shift()
    if (next) {
      next()
    }
  }
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: unknown, path: string[]): unknown {
  let current = obj
  for (const key of path) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Create a proxy that records property accesses
 */
function createRecordingProxy(
  item: unknown,
  recording: PropertyRecording
): unknown {
  if (typeof item !== 'object' || item === null) {
    return item
  }

  return new Proxy(item as Record<string, unknown>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return target[prop as any]
      }

      recording.paths.add(prop)

      const value = target[prop]

      // If accessing a relation (identified by $id or Promise), record it
      if (value && typeof value === 'object' && '$type' in (value as any)) {
        recording.relations.set(prop, {
          type: (value as any).$type,
          isArray: Array.isArray(value),
          nestedPaths: new Set(),
        })
      }

      // Return a nested recording proxy for objects
      if (value && typeof value === 'object') {
        return createRecordingProxy(value, recording)
      }

      return value
    },
  })
}

/**
 * Analyze recordings to find batch-loadable relations
 */
function analyzeBatchLoads(
  recordings: PropertyRecording[],
  items: unknown[]
): Map<string, { type: string; ids: string[] }> {
  const batchLoads = new Map<string, { type: string; ids: string[] }>()

  // Find common relations across all recordings
  const relationCounts = new Map<string, number>()

  for (const recording of recordings) {
    for (const [relationName, relation] of recording.relations) {
      relationCounts.set(relationName, (relationCounts.get(relationName) || 0) + 1)
    }
  }

  // Only batch-load relations accessed in all (or most) items
  for (const [relationName, count] of relationCounts) {
    if (count >= recordings.length * 0.5) {
      // At least 50% of items access this relation
      const ids: string[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown>
        const relationId = item[relationName]
        if (typeof relationId === 'string') {
          ids.push(relationId)
        } else if (relationId && typeof relationId === 'object' && '$id' in relationId) {
          ids.push((relationId as any).$id)
        }
      }

      if (ids.length > 0) {
        const relation = recordings[0]?.relations.get(relationName)
        if (relation) {
          batchLoads.set(relationName, { type: relation.type, ids })
        }
      }
    }
  }

  return batchLoads
}

/**
 * Execute batch loads for relations
 */
async function executeBatchLoads(
  batchLoads: Map<string, { type: string; ids: string[] }>
): Promise<Map<string, Map<string, unknown>>> {
  const results = new Map<string, Map<string, unknown>>()

  // For now, return empty - actual implementation would batch query
  // This is a placeholder that will be filled in by the actual DB integration

  for (const [relationName, { type, ids }] of batchLoads) {
    results.set(relationName, new Map())
  }

  return results
}

/**
 * Apply batch-loaded results to the mapped results
 */
function applyBatchResults<U>(
  results: U[],
  loadedRelations: Map<string, Map<string, unknown>>,
  originalItems: unknown[]
): U[] {
  // For now, return results as-is
  // Actual implementation would inject loaded relations
  return results
}

// =============================================================================
// Check Functions
// =============================================================================

/**
 * Check if a value is a DBPromise
 */
export function isDBPromise(value: unknown): value is DBPromise<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    DB_PROMISE_SYMBOL in value &&
    (value as any)[DB_PROMISE_SYMBOL] === true
  )
}

/**
 * Get the raw DBPromise from a proxied value
 */
export function getRawDBPromise<T>(value: DBPromise<T>): DBPromise<T> {
  if (RAW_DB_PROMISE_SYMBOL in value) {
    return (value as any)[RAW_DB_PROMISE_SYMBOL]
  }
  return value
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a DBPromise for a list query
 */
export function createListPromise<T>(
  type: string,
  executor: () => Promise<T[]>
): DBPromise<T[]> {
  return new DBPromise<T[]>({ type, executor })
}

/**
 * Create a DBPromise for a single entity query
 */
export function createEntityPromise<T>(
  type: string,
  executor: () => Promise<T | null>
): DBPromise<T | null> {
  return new DBPromise<T | null>({ type, executor })
}

/**
 * Create a DBPromise for a search query
 */
export function createSearchPromise<T>(
  type: string,
  executor: () => Promise<T[]>
): DBPromise<T[]> {
  return new DBPromise<T[]>({ type, executor })
}

// =============================================================================
// Entity Operations Wrapper
// =============================================================================

/**
 * Wrap EntityOperations to return DBPromise
 */
export function wrapEntityOperations<T>(
  typeName: string,
  operations: {
    get: (id: string) => Promise<T | null>
    list: (options?: any) => Promise<T[]>
    find: (where: any) => Promise<T[]>
    search: (query: string, options?: any) => Promise<T[]>
    create: (...args: any[]) => Promise<T>
    update: (id: string, data: any) => Promise<T>
    upsert: (id: string, data: any) => Promise<T>
    delete: (id: string) => Promise<boolean>
    forEach: (...args: any[]) => Promise<void>
  }
): {
  get: (id: string) => DBPromise<T | null>
  list: (options?: any) => DBPromise<T[]>
  find: (where: any) => DBPromise<T[]>
  search: (query: string, options?: any) => DBPromise<T[]>
  create: (...args: any[]) => Promise<T>
  update: (id: string, data: any) => Promise<T>
  upsert: (id: string, data: any) => Promise<T>
  delete: (id: string) => Promise<boolean>
  forEach: <U>(callback: (item: T, index: number) => U | Promise<U>, options?: ForEachOptions<T>) => Promise<ForEachResult>
  first: () => DBPromise<T | null>
} {
  return {
    get(id: string): DBPromise<T | null> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.get(id),
      })
    },

    list(options?: any): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.list(options),
      })
    },

    find(where: any): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.find(where),
      })
    },

    search(query: string, options?: any): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.search(query, options),
      })
    },

    first(): DBPromise<T | null> {
      return new DBPromise({
        type: typeName,
        executor: async () => {
          const items = await operations.list({ limit: 1 })
          return items[0] ?? null
        },
      })
    },

    /**
     * Process all entities with concurrency control, progress tracking, and error handling
     *
     * @example
     * ```ts
     * // Simple iteration
     * await db.Lead.forEach(lead => console.log(lead.name))
     *
     * // With AI and concurrency
     * const result = await db.Lead.forEach(async lead => {
     *   const analysis = await ai`analyze ${lead}`
     *   await db.Lead.update(lead.$id, { analysis })
     * }, { concurrency: 10, onProgress: p => console.log(p) })
     * ```
     */
    async forEach<U>(
      callback: (item: T, index: number) => U | Promise<U>,
      options: ForEachOptions<T> = {}
    ): Promise<ForEachResult> {
      // Create a DBPromise for list and use its forEach
      const listPromise = new DBPromise<T[]>({
        type: typeName,
        executor: () => operations.list(),
      })
      return listPromise.forEach(callback as any, options as any)
    },

    // These don't need wrapping - they're mutations
    create: operations.create,
    update: operations.update,
    upsert: operations.upsert,
    delete: operations.delete,
  }
}
