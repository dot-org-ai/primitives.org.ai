/**
 * Batch Map - Automatic batch detection for .map() operations
 *
 * When you call .map() on a list result, the individual operations
 * are captured and automatically batched when resolved.
 *
 * @example
 * ```ts
 * // This automatically batches the write operations
 * const titles = await list`10 blog post titles`
 * const posts = titles.map(title => write`blog post: # ${title}`)
 *
 * // When awaited, posts are generated via batch API
 * console.log(await posts) // 10 blog posts
 * ```
 *
 * @packageDocumentation
 */

// Note: We avoid importing AIPromise here to prevent circular dependencies
// The AI promise module imports from this file for recording mode
import {
  getContext,
  getExecutionTier,
  getProvider,
  getModel,
  isFlexAvailable,
  type ExecutionTier,
} from './context.js'
import { createBatch, getBatchAdapter, type BatchItem, type BatchResult } from './batch-queue.js'
import { generateObject, generateText } from './generate.js'
import type { SimpleSchema } from './schema.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Symbol to identify BatchMapPromise instances
 *
 * Used internally to detect BatchMapPromise objects for proper handling.
 */
export const BATCH_MAP_SYMBOL = Symbol.for('ai-batch-map')

/**
 * A captured operation from the map callback
 *
 * When recording mode is active, AI operations are captured instead of executed.
 * This allows batch processing of multiple operations in a single API call.
 */
export interface CapturedOperation {
  /** Unique ID for this operation */
  id: string
  /** The prompt template */
  prompt: string
  /** The item value that will be substituted */
  itemPlaceholder: string
  /** Schema for structured output */
  schema?: SimpleSchema
  /** Generation type */
  type: 'text' | 'object' | 'boolean' | 'list'
  /** System prompt */
  system?: string
}

/**
 * Options for batch map
 *
 * Control how batch map operations are executed.
 */
export interface BatchMapOptions {
  /** Force immediate execution (no batching) */
  immediate?: boolean
  /** Force batch API (even for small batches) */
  deferred?: boolean
}

// ============================================================================
// BatchMapPromise
// ============================================================================

/**
 * A promise that represents a batch of mapped operations.
 * Resolves by either:
 * - Executing via batch API (for large batches or when deferred)
 * - Executing concurrently (for small batches or when immediate)
 */
export class BatchMapPromise<T> implements PromiseLike<T[]> {
  readonly [BATCH_MAP_SYMBOL] = true

  /** The source list items */
  private _items: unknown[]

  /** The captured operations (one per item) */
  private _operations: CapturedOperation[][]

  /** Options for batch execution */
  private _options: BatchMapOptions

  /** Cached resolver promise */
  private _resolver: Promise<T[]> | null = null

  constructor(items: unknown[], operations: CapturedOperation[][], options: BatchMapOptions = {}) {
    this._items = items
    this._operations = operations
    this._options = options
  }

  /**
   * Get the number of items in the batch
   */
  get size(): number {
    return this._items.length
  }

  /**
   * Resolve the batch
   */
  async resolve(): Promise<T[]> {
    const totalOperations = this._operations.reduce((sum, ops) => sum + ops.length, 0)

    // Determine execution tier
    let tier: ExecutionTier

    if (this._options.deferred) {
      tier = 'batch'
    } else if (this._options.immediate) {
      tier = 'immediate'
    } else {
      tier = getExecutionTier(totalOperations)
    }

    // Execute based on tier
    switch (tier) {
      case 'immediate':
        return this._resolveImmediately()

      case 'flex':
        // Use flex processing if available, otherwise fall back to immediate
        if (isFlexAvailable()) {
          return this._resolveViaFlex()
        }
        console.warn(
          `Flex processing not available for ${getProvider()}, using immediate execution`
        )
        return this._resolveImmediately()

      case 'batch':
        return this._resolveViaBatchAPI()

      default:
        return this._resolveImmediately()
    }
  }

  /**
   * Execute via flex processing (faster than batch, ~50% discount)
   * Available for OpenAI and AWS Bedrock
   */
  private async _resolveViaFlex(): Promise<T[]> {
    const provider = getProvider()
    const model = getModel()

    // Try to get the flex adapter
    try {
      const { getFlexAdapter } = await import('./batch-queue.js')
      const adapter = getFlexAdapter(provider)

      // Build batch items
      const batchItems: BatchItem[] = []
      const itemOperationMap: Map<string, { itemIndex: number; opIndex: number }> = new Map()

      for (let itemIndex = 0; itemIndex < this._items.length; itemIndex++) {
        const item = this._items[itemIndex]
        const operations = this._operations[itemIndex] || []

        for (let opIndex = 0; opIndex < operations.length; opIndex++) {
          const op = operations[opIndex]
          if (!op) continue

          const id = `item_${itemIndex}_op_${opIndex}`
          const prompt = op.prompt.replace(op.itemPlaceholder, String(item))

          batchItems.push({
            id,
            prompt,
            ...(op.schema !== undefined && { schema: op.schema }),
            options: Object.assign({ model }, op.system !== undefined ? { system: op.system } : {}),
            status: 'pending',
          })

          itemOperationMap.set(id, { itemIndex, opIndex })
        }
      }

      // Submit via flex adapter
      const results = await adapter.submitFlex(batchItems, { model })
      return this._reconstructResults(results, itemOperationMap)
    } catch {
      // Flex adapter not available, fall back to batch or immediate
      console.warn(`Flex adapter not available, falling back to batch API`)
      return this._resolveViaBatchAPI()
    }
  }

  /**
   * Execute via provider batch API (deferred, 50% discount)
   */
  private async _resolveViaBatchAPI(): Promise<T[]> {
    const ctx = getContext()
    const provider = getProvider()
    const model = getModel()

    // Try to get the batch adapter
    let adapter
    try {
      adapter = getBatchAdapter(provider)
    } catch {
      // Adapter not registered, fall back to immediate execution
      console.warn(
        `Batch adapter for ${provider} not available, falling back to immediate execution`
      )
      return this._resolveImmediately()
    }

    // Flatten all operations into a single batch
    const batchItems: BatchItem[] = []
    const itemOperationMap: Map<string, { itemIndex: number; opIndex: number }> = new Map()

    for (let itemIndex = 0; itemIndex < this._items.length; itemIndex++) {
      const item = this._items[itemIndex]
      const operations = this._operations[itemIndex] || []

      for (let opIndex = 0; opIndex < operations.length; opIndex++) {
        const op = operations[opIndex]
        if (!op) continue

        const id = `item_${itemIndex}_op_${opIndex}`

        // Substitute the actual item value into the prompt
        const prompt = op.prompt.replace(op.itemPlaceholder, String(item))

        batchItems.push({
          id,
          prompt,
          ...(op.schema !== undefined && { schema: op.schema }),
          options: Object.assign({ model }, op.system !== undefined ? { system: op.system } : {}),
          status: 'pending',
        })

        itemOperationMap.set(id, { itemIndex, opIndex })
      }
    }

    // Submit batch
    const batch = createBatch({
      provider,
      model,
      ...(ctx.webhookUrl !== undefined && { webhookUrl: ctx.webhookUrl }),
      ...(ctx.metadata !== undefined && { metadata: ctx.metadata }),
    })

    for (const item of batchItems) {
      batch.add(item.prompt, {
        ...(item.schema !== undefined && { schema: item.schema }),
        ...(item.options !== undefined && { options: item.options }),
        ...(item.id !== undefined && { customId: item.id }),
      })
    }

    const { completion } = await batch.submit()
    const results = await completion

    // Reconstruct the results array
    return this._reconstructResults(results, itemOperationMap)
  }

  /**
   * Execute immediately (concurrent requests)
   */
  private async _resolveImmediately(): Promise<T[]> {
    const model = getModel()
    const results: T[] = []

    // Process each item
    for (let itemIndex = 0; itemIndex < this._items.length; itemIndex++) {
      const item = this._items[itemIndex]
      const operations = this._operations[itemIndex] || []

      // If there's only one operation per item, resolve it directly
      if (operations.length === 1) {
        const op = operations[0]
        if (op) {
          const prompt = op.prompt.replace(op.itemPlaceholder, String(item))
          const result = await this._executeOperation(op, prompt, model)
          results.push(result as T)
        }
      } else if (operations.length > 0) {
        // Multiple operations per item - resolve as object
        const opResults: Record<string, unknown> = {}

        await Promise.all(
          operations.map(async (op, opIndex) => {
            if (!op) return
            const prompt = op.prompt.replace(op.itemPlaceholder, String(item))
            opResults[`op_${opIndex}`] = await this._executeOperation(op, prompt, model)
          })
        )

        results.push(opResults as T)
      }
    }

    return results
  }

  /**
   * Execute a single operation
   */
  private async _executeOperation(
    op: CapturedOperation,
    prompt: string,
    model: string
  ): Promise<unknown> {
    switch (op.type) {
      case 'text':
        const textResult = await generateText({
          model,
          prompt,
          ...(op.system !== undefined && { system: op.system }),
        })
        return textResult.text

      case 'boolean':
        const boolResult = await generateObject({
          model,
          schema: { answer: 'true | false' },
          prompt,
          system: op.system || 'Answer with true or false.',
        })
        return (boolResult.object as { answer: string }).answer === 'true'

      case 'list':
        const listResult = await generateObject({
          model,
          schema: { items: ['List items'] },
          prompt,
          ...(op.system !== undefined && { system: op.system }),
        })
        return (listResult.object as { items: string[] }).items

      case 'object':
      default:
        const objResult = await generateObject({
          model,
          schema: op.schema || { result: 'The result' },
          prompt,
          ...(op.system !== undefined && { system: op.system }),
        })
        return objResult.object
    }
  }

  /**
   * Reconstruct results from batch response
   */
  private _reconstructResults(
    batchResults: BatchResult[],
    itemOperationMap: Map<string, { itemIndex: number; opIndex: number }>
  ): T[] {
    const results: (T | Record<string, unknown>)[] = new Array(this._items.length)

    // Initialize results array
    for (let i = 0; i < this._items.length; i++) {
      const operations = this._operations[i] || []
      if (operations.length === 1) {
        results[i] = undefined as T
      } else {
        results[i] = {}
      }
    }

    // Fill in results
    for (const batchResult of batchResults) {
      const mapping = itemOperationMap.get(batchResult.id)
      if (!mapping) continue

      const { itemIndex, opIndex } = mapping
      const operations = this._operations[itemIndex] || []

      if (operations.length === 1) {
        results[itemIndex] = batchResult.result as T
      } else {
        ;(results[itemIndex] as Record<string, unknown>)[`op_${opIndex}`] = batchResult.result
      }
    }

    return results as T[]
  }

  /**
   * Promise interface - then()
   */
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (!this._resolver) {
      this._resolver = this.resolve()
    }
    return this._resolver.then(onfulfilled, onrejected)
  }

  /**
   * Promise interface - catch()
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T[] | TResult> {
    return this.then(null, onrejected)
  }

  /**
   * Promise interface - finally()
   */
  finally(onfinally?: (() => void) | null): Promise<T[]> {
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

// ============================================================================
// Recording Context
// ============================================================================

/** Current item value being recorded */
let currentRecordingItem: unknown = null

/** Current item placeholder string */
let currentItemPlaceholder: string = ''

/** Captured operations during recording */
let capturedOperations: CapturedOperation[] = []

/** Recording mode flag */
let isRecording = false

/** Operation counter for unique IDs */
let operationCounter = 0

/**
 * Check if we're in recording mode
 *
 * Recording mode is active during batch map callback execution.
 * When true, AI operations are captured instead of executed.
 *
 * @returns true if currently recording operations for batch processing
 */
export function isInRecordingMode(): boolean {
  return isRecording
}

/**
 * Get the current item placeholder for template substitution
 *
 * During recording mode, this returns a placeholder string that will be
 * replaced with the actual item value when the batch is executed.
 *
 * @returns The placeholder string if in recording mode, null otherwise
 */
export function getCurrentItemPlaceholder(): string | null {
  return isRecording ? currentItemPlaceholder : null
}

/**
 * Capture an operation during recording
 *
 * Called by AI template functions when in recording mode to capture
 * operations for later batch execution.
 *
 * @param prompt - The prompt template
 * @param type - The operation type (text, object, boolean, list)
 * @param schema - Optional schema for structured output
 * @param system - Optional system prompt
 */
export function captureOperation(
  prompt: string,
  type: CapturedOperation['type'],
  schema?: SimpleSchema,
  system?: string
): void {
  if (!isRecording) return

  capturedOperations.push({
    id: `op_${++operationCounter}`,
    prompt,
    itemPlaceholder: currentItemPlaceholder,
    ...(schema !== undefined && { schema }),
    type,
    ...(system !== undefined && { system }),
  })
}

// ============================================================================
// Batch Map Factory
// ============================================================================

/**
 * Create a batch map from an array and a callback
 *
 * This is called internally by AIPromise.map() to enable automatic
 * batch processing of mapped operations.
 *
 * @typeParam T - The type of items in the source array
 * @typeParam U - The return type of the callback
 * @param items - Array of items to map over
 * @param callback - Function called for each item (operations are captured, not executed)
 * @param options - Batch map options
 * @returns A BatchMapPromise that resolves to an array of results
 */
export function createBatchMap<T, U>(
  items: T[],
  callback: (item: T, index: number) => U,
  options: BatchMapOptions = {}
): BatchMapPromise<U> {
  const allOperations: CapturedOperation[][] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as T

    // Enter recording mode
    isRecording = true
    currentRecordingItem = item
    currentItemPlaceholder = `__BATCH_ITEM_${i}__`
    capturedOperations = []

    try {
      // Execute the callback to capture operations
      callback(item, i)

      // Operations should have been captured via captureOperation()
      allOperations.push([...capturedOperations])
    } finally {
      // Exit recording mode
      isRecording = false
      currentRecordingItem = null
      currentItemPlaceholder = ''
      capturedOperations = []
    }
  }

  return new BatchMapPromise<U>(items, allOperations, options)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a value is a BatchMapPromise
 *
 * @param value - Value to check
 * @returns true if value is a BatchMapPromise instance
 */
export function isBatchMapPromise(value: unknown): value is BatchMapPromise<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    BATCH_MAP_SYMBOL in value &&
    (value as Record<symbol, unknown>)[BATCH_MAP_SYMBOL] === true
  )
}
