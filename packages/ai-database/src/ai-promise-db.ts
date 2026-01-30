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

import { Semaphore } from './memory-provider.js'
import type { DBProvider } from './schema.js'
import {
  isEntityArray,
  extractEntityId,
  extractMarkerType,
  isPlainObject,
  hasRelationElements,
  asCallback,
  asPredicate,
  asComparator,
  getSymbolProperty,
  asItem,
} from './type-guards.js'
import { EntityNotFoundError } from './errors.js'

// Provider resolver - will be set by schema.ts
let providerResolver: (() => Promise<DBProvider>) | null = null

/**
 * Set the provider resolver function (called from schema.ts)
 */
export function setProviderResolver(resolver: () => Promise<DBProvider>): void {
  providerResolver = resolver
}

/**
 * Get the provider for batch operations
 */
async function getProvider(): Promise<DBProvider | null> {
  if (providerResolver) {
    return providerResolver()
  }
  return null
}

// Schema info for batch loading - stores relation field info for entity types
// Maps entityType -> fieldName -> relatedType
let schemaRelationInfo: Map<string, Map<string, string>> | null = null

/**
 * Set schema relation info for batch loading nested relations
 * Called from schema.ts when DB() is initialized
 */
export function setSchemaRelationInfo(info: Map<string, Map<string, string>>): void {
  schemaRelationInfo = info
}

/**
 * Get the related type for a field on an entity type
 */
function getRelatedType(entityType: string, fieldName: string): string | undefined {
  if (!schemaRelationInfo) return undefined
  return schemaRelationInfo.get(entityType)?.get(fieldName)
}

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
  /** Actions API for persistence (injected by wrapEntityOperations) */
  actionsAPI?: ForEachActionsAPI
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
  /** Nested relations accessed on this relation (e.g., customer.address where address is a relation) */
  nestedRelations: Map<string, RelationRecording>
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
 * Actions API interface for persistence (internal)
 */
export interface ForEachActionsAPI {
  create(data: { type: string; data: unknown; total?: number }): Promise<{ id: string }>
  get(id: string): Promise<ForEachActionState | null>
  update(id: string, updates: Partial<ForEachActionState>): Promise<unknown>
}

/**
 * Action state for forEach persistence
 */
export interface ForEachActionState {
  id: string
  type: string
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  total?: number
  data: {
    /** IDs of items that have been processed */
    processedIds?: string[]
    [key: string]: unknown
  }
  result?: ForEachResult
  error?: string
}

/**
 * Options for forEach operations
 *
 * @example
 * ```ts
 * // Simple
 * await db.Lead.forEach(lead => console.log(lead.name))
 *
 * // With concurrency
 * await db.Lead.forEach(async lead => {
 *   await processLead(lead)
 * }, { concurrency: 10 })
 *
 * // Persist progress (survives crashes)
 * await db.Lead.forEach(processLead, { persist: true })
 *
 * // Resume from where we left off
 * await db.Lead.forEach(processLead, { resume: 'action-123' })
 * ```
 */
export interface ForEachOptions<T = unknown> {
  /**
   * Maximum concurrent operations (default: 1)
   */
  concurrency?: number

  /**
   * Batch size for fetching items (default: 100)
   */
  batchSize?: number

  /**
   * Maximum retries per item (default: 0)
   */
  maxRetries?: number

  /**
   * Delay between retries in ms, or function for backoff (default: 1000)
   */
  retryDelay?: number | ((attempt: number) => number)

  /**
   * Progress callback
   */
  onProgress?: (progress: ForEachProgress) => void

  /**
   * Error handling: 'continue' | 'retry' | 'skip' | 'stop' (default: 'continue')
   */
  onError?:
    | ForEachErrorAction
    | ((error: Error, item: T, attempt: number) => ForEachErrorAction | Promise<ForEachErrorAction>)

  /**
   * Called when an item completes
   */
  onComplete?: (item: T, result: unknown, index: number) => void | Promise<void>

  /**
   * AbortController signal
   */
  signal?: AbortSignal

  /**
   * Timeout per item in ms
   */
  timeout?: number

  /**
   * Persist progress to actions (survives crashes)
   * - `true`: Auto-name action as "{Entity}.forEach"
   * - `string`: Custom action name
   */
  persist?: boolean | string

  /**
   * Resume from existing action ID (skips already-processed items)
   */
  resume?: string

  /**
   * Filter entities before processing
   */
  where?: Record<string, unknown>
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
  /** Action ID if persistence was enabled */
  actionId?: string
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

    // If result is an array, wrap it with batch-loading map
    if (Array.isArray(result)) {
      this._resolvedValue = createBatchLoadingArray(result) as T
    } else {
      this._resolvedValue = result
    }
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
      ...(this._options.type !== undefined && { type: this._options.type }),
      executor: async () => {
        // Resolve the parent array
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          throw new Error('Cannot map over non-array result')
        }

        // Create recording context
        const recordings: PropertyRecording[] = []

        // Phase 1: Record what the callback accesses for each item (using placeholder proxies)
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const recording: PropertyRecording = {
            paths: new Set(),
            relations: new Map(),
          }

          // Create a recording proxy for this item
          const recordingProxy = createRecordingProxy(item, recording)

          // Execute callback with recording proxy to discover accesses
          // Use asCallback to convert the callback to accept unknown items
          try {
            asCallback(callback)(recordingProxy, i)
          } catch {
            // Ignore errors during recording phase - they'll surface in Phase 3
          }
          recordings.push(recording)
        }

        // Phase 2: Analyze recordings and batch-load relations
        const batchLoads = analyzeBatchLoads(recordings, items)
        const loadedRelations = await executeBatchLoads(batchLoads, recordings)

        // Phase 3: Re-run callback with enriched items that have loaded relations
        const enrichedItems: Record<string, unknown>[] = []
        for (let i = 0; i < items.length; i++) {
          enrichedItems.push(
            enrichItemWithLoadedRelations(items[i] as Record<string, unknown>, loadedRelations)
          )
        }

        // Execute callback again with enriched data
        // Use asCallback to convert the callback to accept unknown items
        const results: U[] = []
        const typedCallback = asCallback(callback)
        for (let i = 0; i < enrichedItems.length; i++) {
          results.push(typedCallback(enrichedItems[i], i))
        }
        return results
      },
    })
  }

  /**
   * Filter results
   */
  filter(predicate: (item: T extends (infer I)[] ? I : T, index: number) => boolean): DBPromise<T> {
    const parentPromise = this

    return new DBPromise<T>({
      ...(this._options.type !== undefined && { type: this._options.type }),
      executor: async () => {
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          return items
        }
        // Use asPredicate to convert the predicate to accept unknown items
        return items.filter(asPredicate(predicate)) as T
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
      ...(this._options.type !== undefined && { type: this._options.type }),
      executor: async () => {
        const items = await parentPromise.resolve()
        if (!Array.isArray(items)) {
          return items
        }
        // Use asComparator to convert the compareFn to accept unknown items
        return [...items].sort(asComparator(compareFn)) as T
      },
    })
  }

  /**
   * Limit results
   */
  limit(n: number): DBPromise<T> {
    const parentPromise = this

    return new DBPromise<T>({
      ...(this._options.type !== undefined && { type: this._options.type }),
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
      ...(this._options.type !== undefined && { type: this._options.type }),
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
      persist,
      resume,
    } = options

    const startTime = Date.now()
    const errors: ForEachResult['errors'] = []
    let completed = 0
    let failed = 0
    let skipped = 0
    let cancelled = false
    let actionId: string | undefined

    // Persistence state
    let processedIds = new Set<string>()
    let persistCounter = 0
    const getItemId = (item: unknown): string => extractEntityId(item) ?? String(item)

    // Get actions API from options (injected by wrapEntityOperations)
    const actionsAPI = this._options.actionsAPI

    // Initialize persistence if enabled
    if (persist || resume) {
      if (!actionsAPI) {
        throw new Error(
          'Persistence requires actions API - use db.Entity.forEach instead of db.Entity.list().forEach'
        )
      }

      // Auto-generate action type from entity name
      const actionType =
        typeof persist === 'string' ? persist : `${this._options.type ?? 'unknown'}.forEach`

      if (resume) {
        // Resume from existing action
        const existingAction = await actionsAPI.get(resume)
        if (existingAction) {
          actionId = existingAction.id
          processedIds = new Set(existingAction.data?.processedIds ?? [])
          await actionsAPI.update(actionId, { status: 'active' })
        } else {
          throw new EntityNotFoundError('Action', resume, 'resume')
        }
      } else {
        // Create new action
        const action = await actionsAPI.create({
          type: actionType,
          data: { processedIds: [] },
        })
        actionId = action.id
      }
    }

    // Resolve the items
    const items = await this.resolve()
    if (!Array.isArray(items)) {
      throw new Error('forEach can only be called on array results')
    }

    const total = items.length

    // Update action with total if persistence is enabled
    if ((persist || resume) && actionId && actionsAPI) {
      await actionsAPI.update(actionId, { total, status: 'active' })
    }

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
        ...(remaining !== undefined && { remaining }),
        rate,
      }
    }

    // Helper to persist progress
    const persistProgress = async (itemId: string): Promise<void> => {
      if ((!persist && !resume) || !actionId || !actionsAPI) return

      processedIds.add(itemId)
      persistCounter++

      // Persist every 10 items to reduce overhead
      if (persistCounter % 10 === 0) {
        await actionsAPI.update(actionId, {
          progress: completed + failed + skipped,
          data: { processedIds: Array.from(processedIds) },
        })
      }
    }

    // Helper to get retry delay
    const getRetryDelay = (attempt: number): number => {
      return typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay
    }

    // Helper to handle error - use asItem for type conversion
    const handleError = async (
      error: Error,
      item: unknown,
      attempt: number
    ): Promise<ForEachErrorAction> => {
      if (typeof onError === 'function') {
        return onError(error, asItem(item), attempt)
      }
      return onError
    }

    // Process a single item with retries
    const processItem = async (item: unknown, index: number): Promise<void> => {
      if (cancelled || signal?.aborted) {
        cancelled = true
        return
      }

      // Check if already processed (for resume)
      const itemId = getItemId(item)
      if (processedIds.has(itemId)) {
        skipped++
        return
      }

      let attempt = 0
      while (true) {
        try {
          // Create timeout wrapper if needed - use asCallback for type conversion
          let result: U
          const typedCallback = asCallback(callback)
          if (timeout) {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
            })
            result = await Promise.race([
              Promise.resolve(typedCallback(item, index)),
              timeoutPromise,
            ])
          } else {
            result = await typedCallback(item, index)
          }

          // Success
          completed++
          await persistProgress(itemId)
          await onComplete?.(asItem(item), result, index)
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
              await persistProgress(itemId) // Still mark as processed
              errors.push({ item, error: error as Error, index })
              onProgress?.(getProgress(index, item))
              return

            case 'skip':
              skipped++
              onProgress?.(getProgress(index, item))
              return

            case 'stop':
              failed++
              await persistProgress(itemId)
              errors.push({ item, error: error as Error, index })
              cancelled = true
              return

            case 'continue':
            default:
              failed++
              await persistProgress(itemId)
              errors.push({ item, error: error as Error, index })
              onProgress?.(getProgress(index, item))
              return
          }
        }
      }
    }

    // Process items with concurrency
    try {
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
    } finally {
      // Final persistence update
      if ((persist || resume) && actionId && actionsAPI) {
        const finalResult: ForEachResult = {
          total,
          completed,
          failed,
          skipped,
          elapsed: Date.now() - startTime,
          errors,
          cancelled,
          actionId,
        }

        const updatePayload: Partial<ForEachActionState> = {
          status: cancelled ? 'failed' : 'completed',
          progress: completed + failed + skipped,
          data: { processedIds: Array.from(processedIds) },
          result: finalResult,
        }
        const errorMessage = cancelled
          ? 'Cancelled'
          : errors.length > 0
          ? `${errors.length} items failed`
          : undefined
        if (errorMessage !== undefined) {
          updatePayload.error = errorMessage
        }
        await actionsAPI.update(actionId, updatePayload)
      }
    }

    return {
      total,
      completed,
      failed,
      skipped,
      elapsed: Date.now() - startTime,
      errors,
      cancelled,
      ...(actionId !== undefined && { actionId }),
    }
  }

  /**
   * Async iteration
   *
   * The yield casts use a local type alias because TypeScript cannot narrow
   * the conditional type `T extends (infer I)[] ? I : T` at runtime.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T extends (infer I)[] ? I : T> {
    type IterItem = T extends (infer I)[] ? I : T
    const items = await this.resolve()
    if (Array.isArray(items)) {
      for (const item of items) {
        yield item as IterItem
      }
    } else {
      yield items as IterItem
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

/**
 * Known DBPromise methods that need proxy handling.
 */
const DBPROMISE_METHODS = new Set([
  'map',
  'filter',
  'sort',
  'limit',
  'first',
  'forEach',
  'resolve',
  'then',
  'catch',
  'finally',
])

/**
 * Known internal properties that need proxy handling.
 */
const INTERNAL_PROPS = new Set(['accessedProps', 'path', 'isResolved'])

/**
 * Type-safe interface for accessing DBPromise internals in proxy context.
 */
interface DBPromiseInternals {
  _options: { type?: string }
  accessedProps: Set<string>
  path: string[]
  isResolved: boolean
  [key: string]: unknown
}

/**
 * Access a property on DBPromise by name, with type safety.
 */
function getDBPromiseProperty(target: DBPromise<unknown>, prop: string): unknown {
  return (target as unknown as DBPromiseInternals)[prop]
}

/**
 * Get and bind a method from DBPromise by name.
 */
function bindDBPromiseMethod(
  target: DBPromise<unknown>,
  prop: string
): (...args: unknown[]) => unknown {
  const method = getDBPromiseProperty(target, prop)
  if (typeof method === 'function') {
    return method.bind(target) as (...args: unknown[]) => unknown
  }
  throw new Error(`${prop} is not a method on DBPromise`)
}

/**
 * Proxy handlers for DBPromise property access tracking.
 *
 * Uses type-safe helper functions to access class methods and properties
 * from within the ProxyHandler where the target type is DBPromise<unknown>.
 */
const DB_PROXY_HANDLERS: ProxyHandler<DBPromise<unknown>> = {
  get(target, prop: string | symbol) {
    // Handle symbols - access internal symbol-keyed properties
    if (typeof prop === 'symbol') {
      if (prop === DB_PROMISE_SYMBOL) return true
      if (prop === RAW_DB_PROMISE_SYMBOL) return target
      if (prop === Symbol.asyncIterator) return target[Symbol.asyncIterator].bind(target)
      // Use getSymbolProperty for type-safe symbol access
      return getSymbolProperty(target, prop)
    }

    // Handle promise and DBPromise methods
    if (DBPROMISE_METHODS.has(prop)) {
      return bindDBPromiseMethod(target, prop)
    }

    // Handle internal properties - private properties and getters
    if (prop.startsWith('_') || INTERNAL_PROPS.has(prop)) {
      return getDBPromiseProperty(target, prop)
    }

    // Track property access
    target.accessedProps.add(prop)

    // Return a new DBPromise for the property path
    const internals = target as unknown as DBPromiseInternals
    const typeValue = internals._options?.type
    return new DBPromise<unknown>({
      ...(typeValue !== undefined && { type: typeValue }),
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
 * Create an array that has a batch-loading map method
 * When .map() is called on the resolved array, it performs batch loading of relations
 */
function createBatchLoadingArray<T>(items: T[]): T[] {
  // Create a new array with all the original items
  const batchArray = [...items] as T[] & {
    map: <U>(callback: (item: T, index: number) => U) => U[] | Promise<U[]>
  }

  // Override the map method to do batch loading only when needed
  // Returns synchronously when no relations are accessed (preserving native Array behavior)
  // Returns a Promise when relations need to be batch-loaded
  Object.defineProperty(batchArray, 'map', {
    value: function <U>(callback: (item: T, index: number) => U): U[] | Promise<U[]> {
      const items = this as T[]

      // Phase 1: Record what the callback accesses using placeholder proxies
      const recordings: PropertyRecording[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const recording: PropertyRecording = {
          paths: new Set(),
          relations: new Map(),
        }

        // Create a recording proxy for this item
        const recordingProxy = createRecordingProxy(item, recording)

        // Execute callback with recording proxy to discover accesses
        try {
          callback(recordingProxy as T, i)
        } catch {
          // Ignore errors during recording phase - they'll surface in Phase 3
        }
        recordings.push(recording)
      }

      // Check if any relations were accessed
      const hasRelations = recordings.some((r) => r.relations.size > 0)

      // If no relations were accessed, run synchronously like native Array.map
      if (!hasRelations) {
        try {
          return Array.prototype.map.call(items, (item: T, i: number) => callback(item, i)) as U[]
        } catch (error) {
          return Promise.reject(error) as unknown as U[]
        }
      }

      // Phase 2 & 3: Async batch loading path (returns a Promise)
      return (async () => {
        const batchLoads = analyzeBatchLoads(recordings, items)
        const loadedRelations = await executeBatchLoads(batchLoads, recordings)

        // Re-run callback with enriched items that have loaded relations
        const enrichedItems: Record<string, unknown>[] = []
        for (let i = 0; i < items.length; i++) {
          enrichedItems.push(
            enrichItemWithLoadedRelations(items[i] as Record<string, unknown>, loadedRelations)
          )
        }

        // Execute callback again with enriched data
        const results: U[] = []
        for (let i = 0; i < enrichedItems.length; i++) {
          results.push(callback(enrichedItems[i] as T, i))
        }
        return results
      })()
    },
    writable: true,
    configurable: true,
    enumerable: false,
  })

  return batchArray
}

/**
 * Create a proxy that records nested property accesses for relations
 * This returns placeholder values to allow the callback to complete
 *
 * When accessing customer.address.city:
 * - At depth 0 (path=[]), accessing 'address' records it in nestedPaths
 * - Accessing 'city' on 'address' creates a nestedRelation for 'address' and records 'city' in its nestedPaths
 */
function createRelationRecordingProxy(
  relationRecording: RelationRecording,
  path: string[] = [],
  currentNestedRecording?: RelationRecording
): unknown {
  // Return a proxy that records all nested accesses
  return new Proxy({} as Record<string, unknown>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return undefined
      }

      // For common array methods that don't need recording
      if (prop === 'map' || prop === 'filter' || prop === 'forEach' || prop === 'length') {
        if (relationRecording.isArray) {
          // Return array-like behavior
          if (prop === 'length') return 0
          if (prop === 'map') return (fn: Function) => []
          if (prop === 'filter') return (fn: Function) => []
          if (prop === 'forEach') return (fn: Function) => {}
        }
        return undefined
      }

      if (path.length === 0) {
        // First level: recording access to properties of the relation itself (e.g., customer.address)
        // This is a direct property access on the relation - record it
        relationRecording.nestedPaths.add(prop)

        // Create a nested recording for potential deeper access
        // We don't know if 'prop' is a relation yet, but if there's further access we'll need it
        let nestedRec = relationRecording.nestedRelations.get(prop)
        if (!nestedRec) {
          nestedRec = {
            type: 'unknown', // Type will be inferred when loading
            isArray: false,
            nestedPaths: new Set(),
            nestedRelations: new Map(),
          }
          relationRecording.nestedRelations.set(prop, nestedRec)
        }

        // Return a proxy that will record further accesses into the nested recording
        return createRelationRecordingProxy(relationRecording, [prop], nestedRec)
      } else {
        // Deeper level: recording access to properties of a nested relation (e.g., customer.address.city)
        // Record this property in the current nested recording
        if (currentNestedRecording) {
          currentNestedRecording.nestedPaths.add(prop)

          // Create another nested recording for even deeper access
          let deeperRec = currentNestedRecording.nestedRelations.get(prop)
          if (!deeperRec) {
            deeperRec = {
              type: 'unknown',
              isArray: false,
              nestedPaths: new Set(),
              nestedRelations: new Map(),
            }
            currentNestedRecording.nestedRelations.set(prop, deeperRec)
          }

          return createRelationRecordingProxy(relationRecording, [...path, prop], deeperRec)
        }

        // Fallback - just record in nestedPaths of root
        relationRecording.nestedPaths.add(prop)
        return createRelationRecordingProxy(relationRecording, [...path, prop])
      }
    },
  })
}

/**
 * Create a proxy that records property accesses
 */
function createRecordingProxy(item: unknown, recording: PropertyRecording): unknown {
  if (typeof item !== 'object' || item === null) {
    return item
  }

  return new Proxy(item as Record<string, unknown>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        // Use getSymbolProperty for type-safe symbol access
        return getSymbolProperty(target, prop)
      }

      recording.paths.add(prop)

      const value = target[prop]

      // If accessing a relation (identified by $type marker from hydration)
      // Note: proxies may not expose $type in 'has' trap, so check via property access
      const maybeType = extractMarkerType(value)
      if (maybeType) {
        const relationType = maybeType

        // Get or create the relation recording
        let relationRecording = recording.relations.get(prop)
        if (!relationRecording) {
          relationRecording = {
            type: relationType,
            isArray: Array.isArray(value),
            nestedPaths: new Set(),
            nestedRelations: new Map(),
          }
          recording.relations.set(prop, relationRecording)
        }

        // Return a proxy that records nested accesses but uses placeholder values
        return createRelationRecordingProxy(relationRecording)
      }

      // Handle arrays with potential relation elements (like members: ['->User'])
      if (Array.isArray(value)) {
        // Check if the array itself is a relation array (has $type marker from thenableArray)
        const arrayMarker = isEntityArray(value) ? value : null
        const arrayType = arrayMarker?.$type
        const isArrayRelationFlag = arrayMarker !== null

        // Also check if array contains relation proxies (for backwards compatibility)
        const hasRelationElementsFlag = !isArrayRelationFlag && hasRelationElements(value)

        if (isArrayRelationFlag || hasRelationElementsFlag) {
          // Get the type from the array $type or first element
          let relationType = arrayType
          if (!relationType) {
            const firstRelation = value.find((v) => extractMarkerType(v) !== undefined)
            relationType = firstRelation ? extractMarkerType(firstRelation) ?? 'unknown' : 'unknown'
          }

          let relationRecording = recording.relations.get(prop)
          if (!relationRecording) {
            relationRecording = {
              type: relationType,
              isArray: true,
              nestedPaths: new Set(),
              nestedRelations: new Map(),
            }
            recording.relations.set(prop, relationRecording)
          }

          // Return a proxy array that records element accesses
          return new Proxy(value, {
            get(arrayTarget, arrayProp) {
              if (arrayProp === 'map') {
                return (fn: Function) => {
                  // Record what the map callback accesses
                  const elementProxy = createRelationRecordingProxy(relationRecording!)
                  // Execute callback to record accesses, but we can't return real results
                  try {
                    fn(elementProxy, 0)
                  } catch {}
                  return []
                }
              }
              if (arrayProp === 'length') return value.length
              if (arrayProp === 'filter') return (fn: Function) => []
              if (arrayProp === 'forEach') return (fn: Function) => {}
              // Numeric index access
              if (!isNaN(Number(arrayProp))) {
                return createRelationRecordingProxy(relationRecording!)
              }
              return Reflect.get(arrayTarget, arrayProp)
            },
          })
        }

        // Regular array - wrap for recording
        return createRecordingProxy(value, recording)
      }

      // Return a nested recording proxy for regular objects
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
    for (const [relationName] of recording.relations) {
      relationCounts.set(relationName, (relationCounts.get(relationName) || 0) + 1)
    }
  }

  // Batch-load any relation that was accessed at least once
  for (const [relationName, count] of relationCounts) {
    if (count > 0) {
      // At least one item accesses this relation
      const ids: string[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown>
        const relationValue = item[relationName]

        // Handle array relations (e.g., members: ['id1', 'id2'])
        if (Array.isArray(relationValue)) {
          for (const element of relationValue) {
            const elementId = extractEntityId(element)
            if (elementId) {
              ids.push(elementId)
            }
          }
        } else {
          // Handle single relations - string ID or proxy object
          const relationId = extractEntityId(relationValue)
          if (relationId) {
            ids.push(relationId)
          }
        }
      }

      if (ids.length > 0) {
        // Find the relation info from any recording that has it
        let relation: RelationRecording | undefined
        for (const recording of recordings) {
          relation = recording.relations.get(relationName)
          if (relation) break
        }
        if (relation) {
          batchLoads.set(relationName, { type: relation.type, ids })
        }
      }
    }
  }

  return batchLoads
}

/** Info about nested relations to load */
interface NestedRelationInfo {
  type: string
  ids: string[]
  nestedPaths: Set<string>
  nestedRelations: Map<string, RelationRecording>
}

/**
 * Execute batch loads for relations, including nested relations recursively
 */
async function executeBatchLoads(
  batchLoads: Map<string, { type: string; ids: string[] }>,
  recordings?: PropertyRecording[]
): Promise<Map<string, Map<string, unknown>>> {
  const results = new Map<string, Map<string, unknown>>()

  const provider = await getProvider()
  if (!provider) {
    // No provider available, return empty results
    for (const [relationName] of batchLoads) {
      results.set(relationName, new Map())
    }
    return results
  }

  // Collect nested relation info from recordings
  const nestedRelationInfo = new Map<
    string,
    { nestedPaths: Set<string>; nestedRelations: Map<string, RelationRecording> }
  >()
  if (recordings) {
    for (const recording of recordings) {
      for (const [relationName, relationRecording] of recording.relations) {
        if (!nestedRelationInfo.has(relationName)) {
          nestedRelationInfo.set(relationName, {
            nestedPaths: new Set(relationRecording.nestedPaths),
            nestedRelations: new Map(relationRecording.nestedRelations),
          })
        } else {
          // Merge nested paths
          const existing = nestedRelationInfo.get(relationName)!
          for (const path of relationRecording.nestedPaths) {
            existing.nestedPaths.add(path)
          }
          for (const [nestedName, nestedRec] of relationRecording.nestedRelations) {
            if (!existing.nestedRelations.has(nestedName)) {
              existing.nestedRelations.set(nestedName, nestedRec)
            }
          }
        }
      }
    }
  }

  // Batch load each relation type
  for (const [relationName, { type, ids }] of batchLoads) {
    const relationResults = new Map<string, unknown>()

    // Deduplicate IDs
    const uniqueIds = [...new Set(ids)]

    // Fetch all entities in parallel
    const entities = await Promise.all(uniqueIds.map((id) => provider.get(type, id)))

    // Map results by ID
    for (let i = 0; i < uniqueIds.length; i++) {
      const entity = entities[i]
      if (entity) {
        const entityId = (entity['$id'] || entity['id']) as string
        relationResults.set(entityId, entity)
      }
    }

    results.set(relationName, relationResults)

    // Check for nested relations that need to be loaded
    const nestedInfo = nestedRelationInfo.get(relationName)
    if (nestedInfo && nestedInfo.nestedPaths.size > 0) {
      // For each nested path, check if it's actually a relation (string ID) on loaded entities
      const nestedBatchLoads = new Map<string, { type: string; ids: string[] }>()

      for (const nestedPath of nestedInfo.nestedPaths) {
        // Collect IDs from all loaded entities for this nested path
        const nestedIds: string[] = []
        let nestedType: string | undefined

        for (const entity of relationResults.values()) {
          const entityObj = entity as Record<string, unknown>
          const entityType = entityObj['$type'] as string | undefined
          const nestedValue = entityObj[nestedPath]

          if (typeof nestedValue === 'string') {
            // It's a string - could be an ID
            nestedIds.push(nestedValue)
            // Try to determine the type from various sources
            if (!nestedType) {
              // First, check the nested relation recording
              const nestedRecording = nestedInfo.nestedRelations.get(nestedPath)
              if (nestedRecording && nestedRecording.type !== 'unknown') {
                nestedType = nestedRecording.type
              }
              // Then, try to get from schema info using the entity's $type
              if (!nestedType && entityType) {
                nestedType = getRelatedType(entityType, nestedPath)
              }
            }
          } else if (isPlainObject(nestedValue)) {
            // Check if it has a $type marker (for already-hydrated proxies)
            const valueType = extractMarkerType(nestedValue)
            if (valueType) {
              nestedType = valueType
              // Try to get the ID via valueOf or $id
              const nestedId = extractEntityId(nestedValue)
              if (nestedId) {
                nestedIds.push(nestedId)
              }
            }
          }
        }

        if (nestedIds.length > 0 && nestedType) {
          nestedBatchLoads.set(nestedPath, { type: nestedType, ids: nestedIds })
        }
      }

      // Recursively load nested relations
      if (nestedBatchLoads.size > 0) {
        // Create nested recordings for the next level if available
        const nestedRecordings: PropertyRecording[] = []
        for (const nestedRecording of nestedInfo.nestedRelations.values()) {
          nestedRecordings.push({
            paths: new Set(),
            relations: new Map([[nestedRecording.type, nestedRecording]]),
          })
        }

        const nestedResults = await executeBatchLoads(
          nestedBatchLoads,
          nestedRecordings.length > 0 ? nestedRecordings : undefined
        )

        // Enrich the already-loaded entities with their nested relations
        for (const [entityId, entity] of relationResults) {
          const enrichedEntity = enrichItemWithLoadedRelations(
            entity as Record<string, unknown>,
            nestedResults
          )
          relationResults.set(entityId, enrichedEntity)
        }
      }
    }
  }

  return results
}

/**
 * Enrich an item with loaded relations, replacing thenable proxies with actual data
 */
function enrichItemWithLoadedRelations(
  item: Record<string, unknown>,
  loadedRelations: Map<string, Map<string, unknown>>
): Record<string, unknown> {
  const enriched: Record<string, unknown> = { ...item }

  for (const [relationName, relationData] of loadedRelations) {
    const relationValue = item[relationName]

    if (relationValue === undefined || relationValue === null) {
      continue
    }

    // Handle array relations
    if (Array.isArray(relationValue)) {
      const loadedArray: unknown[] = []
      for (const element of relationValue) {
        const idStr = extractEntityId(element)
        if (idStr) {
          const loaded = relationData.get(idStr)
          if (loaded) {
            loadedArray.push(loaded)
          }
        }
      }
      enriched[relationName] = loadedArray
    } else {
      // Handle single relations - get the ID from the thenable proxy or direct value
      const relationId = extractEntityId(relationValue)
      if (relationId) {
        const loaded = relationData.get(relationId)
        if (loaded) {
          enriched[relationName] = loaded
        }
      }
    }
  }

  return enriched
}

/**
 * Apply batch-loaded results to the mapped results (deprecated, kept for compatibility)
 */
function applyBatchResults<U>(
  results: U[],
  loadedRelations: Map<string, Map<string, unknown>>,
  originalItems: unknown[]
): U[] {
  // No longer used - enrichment happens before callback re-run
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
    (value as Record<symbol, unknown>)[DB_PROMISE_SYMBOL] === true
  )
}

/**
 * Get the raw DBPromise from a proxied value
 */
export function getRawDBPromise<T>(value: DBPromise<T>): DBPromise<T> {
  if (RAW_DB_PROMISE_SYMBOL in value) {
    // We know the symbol exists from the check above, so this cast is safe
    const raw = (value as Record<symbol, unknown>)[RAW_DB_PROMISE_SYMBOL]
    return raw as DBPromise<T>
  }
  return value
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a DBPromise for a list query
 */
export function createListPromise<T>(type: string, executor: () => Promise<T[]>): DBPromise<T[]> {
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
export function createSearchPromise<T>(type: string, executor: () => Promise<T[]>): DBPromise<T[]> {
  return new DBPromise<T[]>({ type, executor })
}

// =============================================================================
// Entity Operations Wrapper
// =============================================================================

// Import types for wrapEntityOperations
import type {
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  CreateEntityOptions,
  DraftOptions,
  ResolveOptions,
} from './schema/types.js'

/** Type for entity data without system fields */
type EntityData<T> = Omit<T, '$id' | '$type'>

/** Type for partial entity update data */
type EntityUpdateData<T> = Partial<EntityData<T>>

/**
 * Input operations interface for wrapEntityOperations
 * This is compatible with EntityOperations<T> from schema/index.ts
 */
interface WrapEntityInput<T> {
  get: (id: string) => Promise<T | null>
  list: (options?: ListOptions) => Promise<T[]>
  find: (where: Partial<T>) => Promise<T[]>
  search: (query: string, options?: SearchOptions) => Promise<T[]>
  semanticSearch?: (
    query: string,
    options?: SemanticSearchOptions
  ) => Promise<Array<T & { $score: number }>>
  hybridSearch?: (
    query: string,
    options?: HybridSearchOptions
  ) => Promise<
    Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
  >
  // create has overloads in EntityOperations - accept either signature
  create: {
    (data: EntityData<T>): Promise<T>
    (id: string, data: EntityData<T>): Promise<T>
  }
  update: (id: string, data: EntityUpdateData<T>) => Promise<T>
  upsert: (id: string, data: EntityData<T>) => Promise<T>
  delete: (id: string) => Promise<boolean>
  // forEach has overloads in EntityOperations - accept either signature
  forEach: {
    (callback: (entity: T) => void | Promise<void>): Promise<void>
    (options: ListOptions, callback: (entity: T) => void | Promise<void>): Promise<void>
  }
  // Optional draft/resolve from two-phase API (accepting wider types for compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft?: (data: Partial<EntityData<T>>, options?: DraftOptions) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (draft: any, options?: ResolveOptions) => Promise<any>
}

/**
 * Output operations interface for wrapEntityOperations
 * Returns DBPromise for read operations and adds enhanced forEach
 */
interface WrapEntityOutput<T> {
  get: (id: string) => DBPromise<T | null>
  list: (options?: ListOptions) => DBPromise<T[]>
  find: (where: Partial<T>) => DBPromise<T[]>
  search: (query: string, options?: SearchOptions) => DBPromise<T[]>
  semanticSearch: (
    query: string,
    options?: SemanticSearchOptions
  ) => Promise<Array<T & { $score: number }>>
  hybridSearch: (
    query: string,
    options?: HybridSearchOptions
  ) => Promise<
    Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
  >
  // create supports both (data, options?) and (id, data, options?) signatures
  create: {
    (data: EntityData<T>, options?: CreateEntityOptions): Promise<T>
    (id: string, data: EntityData<T>, options?: CreateEntityOptions): Promise<T>
  }
  update: (id: string, data: EntityUpdateData<T>) => Promise<T>
  upsert: (id: string, data: EntityData<T>) => Promise<T>
  delete: (id: string) => Promise<boolean>
  forEach: <U>(
    callback: (item: T, index: number) => U | Promise<U>,
    options?: ForEachOptions<T>
  ) => Promise<ForEachResult>
  first: () => DBPromise<T | null>
  // These may be overwritten after wrapEntityOperations returns
  draft?: (data: EntityData<T>, options?: DraftOptions) => Promise<unknown>
  resolve?: (draft: unknown, options?: ResolveOptions) => Promise<unknown>
  // Index signature for compatibility with Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * Wrap EntityOperations to return DBPromise
 */
export function wrapEntityOperations<T>(
  typeName: string,
  operations: WrapEntityInput<T>,
  actionsAPI?: ForEachActionsAPI
): WrapEntityOutput<T> {
  return {
    get(id: string): DBPromise<T | null> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.get(id),
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
    },

    list(options?: ListOptions): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.list(options),
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
    },

    find(where: Partial<T>): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.find(where),
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
    },

    search(query: string, options?: SearchOptions): DBPromise<T[]> {
      return new DBPromise({
        type: typeName,
        executor: () => operations.search(query, options),
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
    },

    first(): DBPromise<T | null> {
      return new DBPromise({
        type: typeName,
        executor: async () => {
          const items = await operations.list({ limit: 1 })
          return items[0] ?? null
        },
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
    },

    /**
     * Process all entities with concurrency, progress, and optional persistence
     *
     * Supports two calling styles:
     * - forEach(callback, options?) - callback first
     * - forEach(options, callback) - options first (with where filter)
     *
     * @example
     * ```ts
     * await db.Lead.forEach(lead => console.log(lead.name))
     * await db.Lead.forEach(processLead, { concurrency: 10 })
     * await db.Lead.forEach({ where: { status: 'active' } }, processLead)
     * await db.Lead.forEach(processLead, { persist: true })
     * await db.Lead.forEach(processLead, { resume: 'action-123' })
     * ```
     */
    async forEach<U>(
      callbackOrOptions: ((item: T, index: number) => U | Promise<U>) | ForEachOptions<T>,
      callbackOrOpts?: ((item: T, index: number) => U | Promise<U>) | ForEachOptions<T>
    ): Promise<ForEachResult> {
      // Detect which calling style is being used
      const isOptionsFirst =
        typeof callbackOrOptions === 'object' &&
        callbackOrOptions !== null &&
        !('call' in callbackOrOptions)

      const callback = isOptionsFirst
        ? (callbackOrOpts as (item: T, index: number) => U | Promise<U>)
        : (callbackOrOptions as (item: T, index: number) => U | Promise<U>)

      const options = isOptionsFirst
        ? (callbackOrOptions as ForEachOptions<T>)
        : ((callbackOrOpts ?? {}) as ForEachOptions<T>)

      // Extract where filter and pass to list
      const listOptions = options.where ? { where: options.where } : undefined

      const listPromise = new DBPromise<T[]>({
        type: typeName,
        executor: () => operations.list(listOptions),
        ...(actionsAPI !== undefined && { actionsAPI }),
      })
      // The callback and options are properly typed for T, but DBPromise.forEach
      // uses a conditional type. Use asCallback for the callback conversion.
      type ItemType = T[] extends (infer I)[] ? I : T
      return listPromise.forEach(
        asCallback(callback) as (item: ItemType, index: number) => U | Promise<U>,
        options as ForEachOptions<ItemType>
      )
    },

    // Semantic search methods - delegate to underlying operations
    // Return empty array if not available for graceful degradation
    semanticSearch(
      query: string,
      options?: SemanticSearchOptions
    ): Promise<Array<T & { $score: number }>> {
      if (!operations.semanticSearch) {
        // Return empty array for graceful degradation when semantic search not available
        return Promise.resolve([])
      }
      return operations.semanticSearch(query, options)
    },

    hybridSearch(
      query: string,
      options?: HybridSearchOptions
    ): Promise<
      Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
    > {
      if (!operations.hybridSearch) {
        // Return empty array for graceful degradation when hybrid search not available
        return Promise.resolve([])
      }
      return operations.hybridSearch(query, options)
    },

    // Mutations - pass through create which supports both (data, options?) and (id, data, options?)
    create: operations.create as WrapEntityOutput<T>['create'],
    update: operations.update,
    upsert: operations.upsert,
    delete: operations.delete,
  }
}
