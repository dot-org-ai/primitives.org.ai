/**
 * BatchQueue - Deferred execution queue for batch processing
 *
 * Collects AI operations and submits them to provider batch APIs
 * for cost-effective processing (typically 50% discount, 24hr turnaround).
 *
 * @example
 * ```ts
 * // Create a batch queue
 * const batch = createBatch({ provider: 'openai' })
 *
 * // Add items to the batch (these are deferred, not executed)
 * const titles = await list`10 blog post titles about startups`
 * const posts = titles.map(title => batch.add(write`blog post about ${title}`))
 *
 * // Submit the batch - returns job info
 * const job = await batch.submit()
 * console.log(job.id) // batch_abc123
 *
 * // Poll for results or use webhook
 * const results = await batch.wait()
 * ```
 *
 * @packageDocumentation
 */

import type { FunctionOptions } from './template.js'
import type { SimpleSchema } from './schema.js'
import { getLogger } from './logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Batch processing mode
 *
 * - `sync`: Process synchronously (blocking)
 * - `async`: Process asynchronously (non-blocking)
 * - `background`: Process in background (fire and forget)
 */
export type BatchMode = 'sync' | 'async' | 'background'

/**
 * Supported batch providers
 *
 * - `openai`: OpenAI Batch API with 50% discount, up to 24hr turnaround
 * - `anthropic`: Anthropic Message Batches API
 * - `google`: Google AI batch processing
 * - `bedrock`: AWS Bedrock batch inference
 * - `cloudflare`: Cloudflare Workers AI batch processing
 */
export type BatchProvider = 'openai' | 'anthropic' | 'google' | 'bedrock' | 'cloudflare'

/**
 * Status of a batch job
 *
 * Lifecycle: pending -> validating -> in_progress -> finalizing -> completed
 * Error states: failed, expired, cancelled
 * Cancel states: cancelling -> cancelled
 */
export type BatchStatus =
  | 'pending'
  | 'validating'
  | 'in_progress'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelling'
  | 'cancelled'

/**
 * Individual item in a batch
 *
 * Represents a single prompt/request within a batch job. Each item has its own
 * ID, prompt, optional schema, and tracks its own completion status and result.
 *
 * @typeParam T - The expected result type for this item
 */
export interface BatchItem<T = unknown> {
  /** Unique ID for this item */
  id: string
  /** The prompt to process */
  prompt: string
  /** Schema for structured output */
  schema?: SimpleSchema
  /** Generation options */
  options?: FunctionOptions
  /** Custom metadata */
  metadata?: Record<string, unknown>
  /** Resolved value (after completion) */
  result?: T
  /** Error if failed */
  error?: string
  /** Status of this item */
  status: 'pending' | 'completed' | 'failed'
}

/**
 * Batch job information
 *
 * Contains metadata about a submitted batch job including its status,
 * progress, and timing information. Used to track and manage batch jobs.
 */
export interface BatchJob {
  /** Unique batch ID */
  id: string
  /** Provider this batch was submitted to */
  provider: BatchProvider
  /** Current status */
  status: BatchStatus
  /** Number of items in the batch */
  totalItems: number
  /** Number of completed items */
  completedItems: number
  /** Number of failed items */
  failedItems: number
  /** When the batch was created */
  createdAt: Date
  /** When the batch started processing */
  startedAt?: Date
  /** When the batch completed */
  completedAt?: Date
  /** Expected completion time */
  expiresAt?: Date
  /** Webhook URL for completion notification */
  webhookUrl?: string
  /** Input file ID (for OpenAI) */
  inputFileId?: string
  /** Output file ID (for OpenAI) */
  outputFileId?: string
  /** Error file ID (for OpenAI) */
  errorFileId?: string
}

/**
 * Result of a batch submission
 *
 * Returned when a batch is submitted to the provider. Contains the job
 * information and a promise that resolves when the batch completes.
 */
export interface BatchSubmitResult {
  job: BatchJob
  /** Promise that resolves when batch is complete */
  completion: Promise<BatchResult[]>
}

/**
 * Result of a single item in the batch
 *
 * Contains the outcome of processing a single item including success/failure
 * status, result data, and token usage information.
 *
 * @typeParam T - The type of the result data
 */
export interface BatchResult<T = unknown> {
  /** Item ID */
  id: string
  /** Custom ID if provided */
  customId?: string
  /** Status */
  status: 'completed' | 'failed'
  /** The result (if successful) */
  result?: T
  /** Error message (if failed) */
  error?: string
  /** Token usage */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Options for creating a batch queue
 *
 * Configure the batch queue behavior including provider selection,
 * model, webhook notifications, and auto-submission thresholds.
 */
export interface BatchQueueOptions {
  /** Provider to use for batch processing */
  provider?: BatchProvider
  /** Model to use */
  model?: string
  /** Webhook URL for completion notification */
  webhookUrl?: string
  /** Custom metadata for the batch */
  metadata?: Record<string, unknown>
  /** Maximum items per batch (provider-specific limits) */
  maxItems?: number
  /** Auto-submit when queue reaches maxItems */
  autoSubmit?: boolean
}

// ============================================================================
// BatchQueue Implementation
// ============================================================================

/**
 * Event handler type for BatchQueue events
 */
export type BatchEventHandler<T = unknown> = (data: T) => void

/**
 * BatchQueue collects AI operations for deferred batch execution
 */
export class BatchQueue {
  private items: BatchItem[] = []
  private options: BatchQueueOptions
  private idCounter = 0
  private submitted = false
  private job: BatchJob | null = null

  // Error handling properties
  private _autoSubmitPromise: Promise<void> | null = null
  private _submissionError: Error | null = null
  private _eventHandlers: Map<string, Set<BatchEventHandler>> = new Map()

  constructor(options: BatchQueueOptions = {}) {
    this.options = {
      provider: 'openai',
      maxItems: 50000, // OpenAI's limit
      autoSubmit: false,
      ...options,
    }
  }

  /**
   * Subscribe to batch events
   * @param event - Event name ('error', 'partial-failure', 'complete')
   * @param handler - Event handler function
   */
  on<T = unknown>(event: string, handler: BatchEventHandler<T>): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set())
    }
    this._eventHandlers.get(event)!.add(handler as BatchEventHandler)
  }

  /**
   * Unsubscribe from batch events
   */
  off(event: string, handler: BatchEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler)
  }

  /**
   * Emit an event to all subscribed handlers
   */
  private emit<T>(event: string, data: T): void {
    this._eventHandlers.get(event)?.forEach((handler) => handler(data))
  }

  /**
   * Get the auto-submit promise (if auto-submit was triggered)
   */
  get autoSubmitPromise(): Promise<void> | undefined {
    return this._autoSubmitPromise ?? undefined
  }

  /**
   * Get the last submission error (if any)
   */
  get submissionError(): Error | undefined {
    return this._submissionError ?? undefined
  }

  /**
   * Check if there was a submission error
   */
  get hasSubmissionError(): boolean {
    return this._submissionError !== null
  }

  /**
   * Await auto-submit completion or failure
   * Returns a promise that resolves when auto-submit completes or rejects on error
   */
  awaitAutoSubmit(): Promise<void> {
    if (!this._autoSubmitPromise) {
      return Promise.resolve()
    }
    return this._autoSubmitPromise
  }

  /**
   * Get items that failed during batch processing
   */
  getFailedItems(): BatchItem[] {
    return this.items.filter((item) => item.status === 'failed')
  }

  /**
   * Retry a failed submission
   * Only available after a failed auto-submit
   */
  async retry(): Promise<BatchSubmitResult> {
    if (!this._submissionError) {
      throw new Error('No failed submission to retry')
    }

    // Reset error state and submitted flag
    this._submissionError = null
    this.submitted = false

    // Reset item statuses
    for (const item of this.items) {
      if (item.status === 'failed') {
        item.status = 'pending'
        delete item.error
      }
    }

    return this.submit()
  }

  /**
   * Add an item to the batch queue
   * Returns a placeholder that will be resolved after batch completion
   */
  add<T = unknown>(
    prompt: string,
    options?: {
      schema?: SimpleSchema
      options?: FunctionOptions
      customId?: string
      metadata?: Record<string, unknown>
    }
  ): BatchItem<T> {
    if (this.submitted) {
      throw new Error('Cannot add items to a submitted batch')
    }

    const item: BatchItem<T> = {
      id: options?.customId || `item_${++this.idCounter}`,
      prompt,
      ...(options?.schema !== undefined && { schema: options.schema }),
      ...(options?.options !== undefined && { options: options.options }),
      ...(options?.metadata !== undefined && { metadata: options.metadata }),
      status: 'pending',
    }

    this.items.push(item as BatchItem)

    // Auto-submit if we hit the limit
    if (this.options.autoSubmit && this.items.length >= (this.options.maxItems || 50000)) {
      // Create a trackable promise for auto-submit
      this._autoSubmitPromise = this.submit()
        .then(() => {
          // Success - promise is resolved
        })
        .catch((error: Error) => {
          // Store error and update item statuses
          this._submissionError = error
          this.submitted = false // Reset to allow retry

          // Update all items to failed status
          for (const item of this.items) {
            if (item.status === 'pending') {
              item.status = 'failed'
              item.error = error.message
            }
          }

          // Create a synthetic failed job to store error info
          const errorWithMeta = error as Error & {
            status?: number
            headers?: Record<string, string>
          }
          this.job = {
            id: `failed_${Date.now()}`,
            provider: this.options.provider || 'openai',
            status: 'failed',
            totalItems: this.items.length,
            completedItems: 0,
            failedItems: this.items.length,
            createdAt: new Date(),
            // Add rate limit retry info if available
            ...(errorWithMeta.headers?.['retry-after'] && {
              retryAfter: parseInt(errorWithMeta.headers['retry-after'], 10),
            }),
          } as BatchJob & { retryAfter?: number }

          // Emit error event
          this.emit('error', error)

          // Log error and re-throw
          getLogger().error('Batch auto-submit failed:', error)
          throw error
        })
    }

    return item
  }

  /**
   * Get all items in the queue
   */
  getItems(): BatchItem[] {
    return [...this.items]
  }

  /**
   * Get the number of items in the queue
   */
  get size(): number {
    return this.items.length
  }

  /**
   * Check if the batch has been submitted
   */
  get isSubmitted(): boolean {
    return this.submitted
  }

  /**
   * Get the batch job info (after submission)
   */
  getJob(): BatchJob | null {
    return this.job
  }

  /**
   * Submit the batch to the provider
   */
  async submit(): Promise<BatchSubmitResult> {
    if (this.submitted) {
      throw new Error('Batch has already been submitted')
    }

    if (this.items.length === 0) {
      throw new Error('Cannot submit empty batch')
    }

    this.submitted = true

    // Get the appropriate batch adapter
    const adapter = getBatchAdapter(this.options.provider || 'openai')

    // Submit the batch
    const result = await adapter.submit(this.items, this.options)
    this.job = result.job

    // When completion resolves, update item statuses and check for partial failures
    result.completion.then((results) => {
      const failedResults: BatchResult[] = []

      for (const r of results) {
        const item = this.items.find((i) => i.id === r.id)
        if (item) {
          item.status = r.status
          if (r.result !== undefined) item.result = r.result
          if (r.error !== undefined) item.error = r.error

          if (r.status === 'failed') {
            failedResults.push(r)
          }
        }
      }

      // Emit partial-failure event if some items failed
      if (failedResults.length > 0 && failedResults.length < results.length) {
        this.emit('partial-failure', failedResults)
      }

      // Emit error event if there were any failures
      if (failedResults.length > 0) {
        this.emit('error', new Error(`${failedResults.length} items failed in batch`))
      }

      // Emit complete event
      this.emit('complete', results)
    })

    return result
  }

  /**
   * Cancel the batch (if supported by provider)
   */
  async cancel(): Promise<void> {
    if (!this.job) {
      throw new Error('Batch has not been submitted')
    }

    const adapter = getBatchAdapter(this.options.provider || 'openai')
    await adapter.cancel(this.job.id)
    this.job.status = 'cancelling'
  }

  /**
   * Get the current status of the batch
   */
  async getStatus(): Promise<BatchJob> {
    if (!this.job) {
      throw new Error('Batch has not been submitted')
    }

    const adapter = getBatchAdapter(this.options.provider || 'openai')
    this.job = await adapter.getStatus(this.job.id)
    return this.job
  }

  /**
   * Wait for the batch to complete and return results
   */
  async wait(pollInterval = 5000): Promise<BatchResult[]> {
    if (!this.job) {
      throw new Error('Batch has not been submitted')
    }

    const adapter = getBatchAdapter(this.options.provider || 'openai')
    return adapter.waitForCompletion(this.job.id, pollInterval)
  }
}

// ============================================================================
// Batch Adapters
// ============================================================================

/**
 * Interface for provider-specific batch implementations
 *
 * Implement this interface to add support for a new batch processing provider.
 * Each provider (OpenAI, Anthropic, etc.) has its own adapter implementation.
 */
export interface BatchAdapter {
  /** Submit a batch to the provider */
  submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult>
  /** Get the status of a batch */
  getStatus(batchId: string): Promise<BatchJob>
  /** Cancel a batch */
  cancel(batchId: string): Promise<void>
  /** Get results of a completed batch */
  getResults(batchId: string): Promise<BatchResult[]>
  /** Wait for batch completion */
  waitForCompletion(batchId: string, pollInterval?: number): Promise<BatchResult[]>
}

/**
 * Interface for flex processing (faster than batch, ~50% discount)
 *
 * Flex processing provides the same cost savings as batch processing
 * but with faster turnaround (minutes instead of hours).
 * Currently available for OpenAI and AWS Bedrock only.
 */
export interface FlexAdapter {
  /**
   * Submit items for flex processing
   * Flex is faster than batch (minutes vs hours) but has same discount
   *
   * @param items - Items to process
   * @param options - Processing options
   * @returns Results (resolves when all items complete)
   */
  submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]>
}

// Adapter registry
const adapters: Record<BatchProvider, BatchAdapter | null> = {
  openai: null,
  anthropic: null,
  google: null,
  bedrock: null,
  cloudflare: null,
}

// Flex adapter registry (only OpenAI and Bedrock support flex)
const flexAdapters: Record<BatchProvider, FlexAdapter | null> = {
  openai: null,
  anthropic: null,
  google: null,
  bedrock: null,
  cloudflare: null,
}

/**
 * Register a batch adapter for a provider
 *
 * Call this to register a custom batch adapter for a provider.
 * This is typically done by provider-specific packages.
 *
 * @param provider - The provider to register the adapter for
 * @param adapter - The batch adapter implementation
 *
 * @example
 * ```ts
 * import { registerBatchAdapter } from 'ai-functions'
 * import { OpenAIBatchAdapter } from './openai-adapter'
 *
 * registerBatchAdapter('openai', new OpenAIBatchAdapter())
 * ```
 */
export function registerBatchAdapter(provider: BatchProvider, adapter: BatchAdapter): void {
  adapters[provider] = adapter
}

/**
 * Register a flex adapter for a provider
 *
 * Flex adapters provide faster-than-batch processing with the same cost savings.
 * Only OpenAI and AWS Bedrock currently support flex processing.
 *
 * @param provider - The provider to register the adapter for
 * @param adapter - The flex adapter implementation
 */
export function registerFlexAdapter(provider: BatchProvider, adapter: FlexAdapter): void {
  flexAdapters[provider] = adapter
}

/**
 * Get the batch adapter for a provider
 *
 * @param provider - The provider to get the adapter for
 * @returns The registered batch adapter
 * @throws Error if no adapter is registered for the provider
 */
export function getBatchAdapter(provider: BatchProvider): BatchAdapter {
  const adapter = adapters[provider]
  if (!adapter) {
    throw new Error(
      `No batch adapter registered for provider: ${provider}. ` +
        `Import the adapter: import 'ai-functions/batch/${provider}'`
    )
  }
  return adapter
}

/**
 * Get the flex adapter for a provider
 *
 * @param provider - The provider to get the adapter for
 * @returns The registered flex adapter
 * @throws Error if no flex adapter is registered (flex not supported by provider)
 */
export function getFlexAdapter(provider: BatchProvider): FlexAdapter {
  const adapter = flexAdapters[provider]
  if (!adapter) {
    throw new Error(
      `No flex adapter registered for provider: ${provider}. ` +
        `Flex processing is only available for OpenAI and AWS Bedrock.`
    )
  }
  return adapter
}

/**
 * Check if flex processing is available for a provider
 *
 * @param provider - The provider to check
 * @returns true if flex adapter is registered, false otherwise
 */
export function hasFlexAdapter(provider: BatchProvider): boolean {
  return flexAdapters[provider] !== null
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new batch queue
 *
 * @example
 * ```ts
 * const batch = createBatch({ provider: 'openai' })
 * batch.add('Write a poem about cats')
 * batch.add('Write a poem about dogs')
 * const { job } = await batch.submit()
 * const results = await batch.wait()
 * ```
 */
export function createBatch(options?: BatchQueueOptions): BatchQueue {
  return new BatchQueue(options)
}

/**
 * Execute operations in batch mode
 *
 * @example
 * ```ts
 * const results = await withBatch(async (batch) => {
 *   const titles = ['TypeScript', 'React', 'Next.js']
 *   return titles.map(title => batch.add(`Write a blog post about ${title}`))
 * })
 * ```
 */
export async function withBatch<T>(
  fn: (batch: BatchQueue) => T[] | Promise<T[]>,
  options?: BatchQueueOptions
): Promise<BatchResult<T>[]> {
  const batch = createBatch(options)
  const items = await fn(batch)
  if (batch.size === 0) {
    return []
  }
  const { completion } = await batch.submit()
  return completion as Promise<BatchResult<T>[]>
}

// ============================================================================
// Deferred Execution Support
// ============================================================================

/**
 * Symbol to mark an AIPromise as batched/deferred
 *
 * Used internally to identify promises that should be processed via batch API.
 */
export const BATCH_MODE_SYMBOL = Symbol.for('ai-batch-mode')

/**
 * Options for deferred execution
 *
 * Extends FunctionOptions with batch-specific settings.
 */
export interface DeferredOptions extends FunctionOptions {
  /** Batch queue to add to */
  batch?: BatchQueue
  /** Custom ID for this item in the batch */
  customId?: string
}

/**
 * Check if we're in batch mode
 *
 * @param options - Options that may contain a batch queue
 * @returns true if a batch queue is present in options
 */
export function isBatchMode(options?: DeferredOptions): boolean {
  return !!options?.batch
}

/**
 * Add an operation to the batch queue instead of executing immediately
 *
 * @typeParam T - The expected result type
 * @param batch - The batch queue to add to
 * @param prompt - The prompt to process
 * @param schema - Optional schema for structured output
 * @param options - Additional options including custom ID
 * @returns A BatchItem that will be resolved when the batch completes
 */
export function deferToBatch<T>(
  batch: BatchQueue,
  prompt: string,
  schema: SimpleSchema | undefined,
  options?: FunctionOptions & { customId?: string }
): BatchItem<T> {
  return batch.add<T>(prompt, {
    ...(schema !== undefined && { schema }),
    ...(options !== undefined && { options }),
    ...(options?.customId !== undefined && { customId: options.customId }),
  })
}
