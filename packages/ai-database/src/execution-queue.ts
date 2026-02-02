/**
 * Execution Queue - Manages execution priority and batching
 *
 * The queue decides WHEN to execute based on priority, concurrency, and batch windows.
 * Operations can be executed immediately, queued, or deferred to batch processing.
 *
 * @packageDocumentation
 */

import { Semaphore } from './memory-provider.js'
import {
  DurablePromise,
  setBatchScheduler,
  type ExecutionPriority,
  type BatchScheduler,
} from './durable-promise.js'
import { logError, logInfo } from './logger.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the execution queue
 */
export interface ExecutionQueueOptions {
  /** Default execution priority */
  priority?: ExecutionPriority

  /** Maximum concurrent operations per priority tier */
  concurrency?: {
    priority?: number
    standard?: number
    flex?: number
    batch?: number
  }

  /** Batch window in milliseconds (how long to accumulate before flush) */
  batchWindow?: number

  /** Maximum batch size before auto-flush */
  maxBatchSize?: number

  /** Auto-flush at process exit */
  flushOnExit?: boolean
}

/**
 * Stats for queue monitoring
 */
export interface QueueStats {
  /** Counts by priority tier */
  byPriority: Record<ExecutionPriority, { pending: number; active: number; completed: number }>
  /** Total counts */
  totals: { pending: number; active: number; completed: number; failed: number }
  /** Current batch info */
  batch: { size: number; nextFlush: Date | null }
}

/**
 * Batch submission result from a provider
 */
export interface BatchSubmission {
  /** Provider-assigned batch ID */
  batchId: string
  /** Estimated completion time */
  estimatedCompletion?: Date
  /** Number of requests in batch */
  count: number
}

/**
 * Provider interface for batch submission
 */
export interface BatchProvider {
  /** Provider name */
  readonly name: string
  /** Whether this provider supports batch API */
  readonly supportsBatch: boolean
  /** Whether this provider supports flex tier */
  readonly supportsFlex: boolean

  /** Submit a batch of requests */
  submitBatch(requests: BatchRequest[]): Promise<BatchSubmission>

  /** Get batch status */
  getBatchStatus(batchId: string): Promise<BatchStatus>

  /** Stream results as they complete */
  streamResults(batchId: string): AsyncIterable<BatchResult>
}

/**
 * A single request in a batch
 */
export interface BatchRequest {
  /** Unique ID for matching results */
  customId: string
  /** The action ID (for updating status) */
  actionId: string
  /** Method being called */
  method: string
  /** Request parameters */
  params: unknown
}

/**
 * Status of a batch
 */
export interface BatchStatus {
  /** Batch ID */
  batchId: string
  /** Current status */
  status: 'validating' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'cancelled'
  /** Completion counts */
  counts: {
    total: number
    completed: number
    failed: number
  }
  /** Estimated completion */
  estimatedCompletion?: Date
  /** Error message if failed */
  error?: string
}

/**
 * A single result from a batch
 */
export interface BatchResult {
  /** Custom ID matching the request */
  customId: string
  /** Action ID for updating status */
  actionId: string
  /** Success or failure */
  status: 'success' | 'error'
  /** Result data (if success) */
  result?: unknown
  /** Error details (if error) */
  error?: {
    code: string
    message: string
  }
}

// =============================================================================
// Queue Item
// =============================================================================

interface QueueItem {
  promise: DurablePromise<unknown>
  priority: ExecutionPriority
  enqueuedAt: Date
  concurrencyKey?: string
}

// =============================================================================
// ExecutionQueue Class
// =============================================================================

/**
 * Manages execution of DurablePromises with priority-based scheduling
 *
 * @example
 * ```ts
 * const queue = new ExecutionQueue({
 *   priority: 'standard',
 *   concurrency: { standard: 10, batch: 1000 },
 *   batchWindow: 60000, // 1 minute
 * })
 *
 * // Register batch providers
 * queue.registerProvider(openaiProvider)
 * queue.registerProvider(claudeProvider)
 *
 * // Queue operations
 * queue.enqueue(durablePromise)
 *
 * // Flush batch at end of workflow
 * await queue.flush()
 * ```
 */
export class ExecutionQueue implements BatchScheduler {
  private readonly semaphores: Record<ExecutionPriority, Semaphore>
  private readonly queues: Record<ExecutionPriority, QueueItem[]>
  private readonly providers = new Map<string, BatchProvider>()
  private readonly options: Required<ExecutionQueueOptions>

  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private completedCount = 0
  private failedCount = 0
  private isProcessing = false

  constructor(options: ExecutionQueueOptions = {}) {
    this.options = {
      priority: options.priority ?? 'standard',
      concurrency: {
        priority: options.concurrency?.priority ?? 50,
        standard: options.concurrency?.standard ?? 20,
        flex: options.concurrency?.flex ?? 10,
        batch: options.concurrency?.batch ?? 1000,
      },
      batchWindow: options.batchWindow ?? 60000, // 1 minute default
      maxBatchSize: options.maxBatchSize ?? 10000,
      flushOnExit: options.flushOnExit ?? true,
    }

    // Initialize semaphores for each priority tier
    this.semaphores = {
      priority: new Semaphore(this.options.concurrency.priority!),
      standard: new Semaphore(this.options.concurrency.standard!),
      flex: new Semaphore(this.options.concurrency.flex!),
      batch: new Semaphore(this.options.concurrency.batch!),
    }

    // Initialize queues
    this.queues = {
      priority: [],
      standard: [],
      flex: [],
      batch: [],
    }

    // Register as global batch scheduler
    setBatchScheduler(this)

    // Setup exit handler
    if (this.options.flushOnExit && typeof process !== 'undefined') {
      const exitHandler = async () => {
        await this.flush()
      }

      process.on('beforeExit', exitHandler)
      process.on('SIGINT', async () => {
        await exitHandler()
        process.exit(0)
      })
      process.on('SIGTERM', async () => {
        await exitHandler()
        process.exit(0)
      })
    }
  }

  // ===========================================================================
  // Provider Management
  // ===========================================================================

  /**
   * Register a batch provider
   */
  registerProvider(provider: BatchProvider): void {
    this.providers.set(provider.name, provider)
  }

  /**
   * Get a registered provider
   */
  getProvider(name: string): BatchProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * List registered providers
   */
  listProviders(): BatchProvider[] {
    return Array.from(this.providers.values())
  }

  // ===========================================================================
  // Queue Operations
  // ===========================================================================

  /**
   * Add a promise to the execution queue
   */
  enqueue(promise: DurablePromise<unknown>): void {
    const item: QueueItem = {
      promise,
      priority: promise.priority,
      enqueuedAt: new Date(),
    }

    this.queues[promise.priority].push(item)

    // For batch, start the window timer
    if (promise.priority === 'batch') {
      this.startBatchTimer()

      // Check for auto-flush on size
      if (this.queues.batch.length >= this.options.maxBatchSize) {
        this.flush()
      }
    } else {
      // For other priorities, process immediately
      this.processQueue(promise.priority)
    }
  }

  private startBatchTimer(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(async () => {
      this.batchTimer = null
      await this.flush()
    }, this.options.batchWindow)
  }

  private async processQueue(priority: ExecutionPriority): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    const queue = this.queues[priority]
    const semaphore = this.semaphores[priority]

    try {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break

        // Run with concurrency control
        // The promise will execute itself; we just track completion
        semaphore.run(async () => {
          try {
            await item.promise
            this.completedCount++
          } catch {
            this.failedCount++
          }
        })
      }
    } finally {
      this.isProcessing = false
    }
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  /**
   * Flush all pending batch operations
   */
  async flush(): Promise<void> {
    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    const batchItems = [...this.queues.batch]
    this.queues.batch = []

    if (batchItems.length === 0) return

    // Group by method/provider
    const groups = this.groupByProvider(batchItems)

    // Submit each group to its provider
    const submissions = await Promise.all(
      Array.from(groups.entries()).map(async ([providerName, items]) => {
        const provider = this.providers.get(providerName)
        if (!provider) {
          // Fallback to standard execution if no provider
          return this.executeFallback(items)
        }

        return this.submitToBatchProvider(provider, items)
      })
    )

    // Wait for all batch results
    await Promise.all(
      submissions.map((submission) => {
        if (submission && 'batchId' in submission) {
          return this.pollBatchCompletion(submission)
        }
        return Promise.resolve()
      })
    )
  }

  private groupByProvider(items: QueueItem[]): Map<string, QueueItem[]> {
    const groups = new Map<string, QueueItem[]>()

    for (const item of items) {
      // Determine provider from method prefix
      const providerName = this.getProviderFromMethod(item.promise.method)
      const existing = groups.get(providerName) || []
      existing.push(item)
      groups.set(providerName, existing)
    }

    return groups
  }

  private getProviderFromMethod(method: string): string {
    // Extract provider from method like 'openai.chat' -> 'openai'
    const parts = method.split('.')
    return parts[0] || 'default'
  }

  private async submitToBatchProvider(
    provider: BatchProvider,
    items: QueueItem[]
  ): Promise<BatchSubmission | null> {
    if (!provider.supportsBatch) {
      await this.executeFallback(items)
      return null
    }

    const requests: BatchRequest[] = items.map((item) => ({
      customId: crypto.randomUUID(),
      actionId: item.promise.actionId,
      method: item.promise.method,
      params: {}, // Would need to extract from promise
    }))

    try {
      return await provider.submitBatch(requests)
    } catch (error) {
      logError(`Batch submission failed for ${provider.name}:`, error)
      await this.executeFallback(items)
      return null
    }
  }

  private async executeFallback(items: QueueItem[]): Promise<void> {
    // Execute as standard priority
    for (const item of items) {
      this.queues.standard.push(item)
    }
    await this.processQueue('standard')
  }

  private async pollBatchCompletion(submission: BatchSubmission): Promise<void> {
    // This would be implemented by the specific provider
    // For now, just log
    logInfo(`Batch ${submission.batchId} submitted with ${submission.count} requests`)

    // In production, this would poll getBatchStatus and stream results
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the default priority for new operations
   */
  setPriority(priority: ExecutionPriority): void {
    this.options.priority = priority
  }

  /**
   * Set concurrency limit for a priority tier
   */
  setConcurrency(priority: ExecutionPriority, limit: number): void {
    this.options.concurrency[priority] = limit
    // Re-create the semaphore (existing operations continue with old limit)
    this.semaphores[priority] = new Semaphore(limit)
  }

  /**
   * Set the batch window (how long to accumulate before auto-flush)
   */
  setBatchWindow(ms: number): void {
    this.options.batchWindow = ms
  }

  /**
   * Set max batch size before auto-flush
   */
  setMaxBatchSize(size: number): void {
    this.options.maxBatchSize = size
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  /**
   * Get count of pending operations
   */
  get pending(): number {
    return (
      this.queues.priority.length +
      this.queues.standard.length +
      this.queues.flex.length +
      this.queues.batch.length
    )
  }

  /**
   * Get count of active operations
   */
  get active(): number {
    return (
      this.semaphores.priority.active +
      this.semaphores.standard.active +
      this.semaphores.flex.active +
      this.semaphores.batch.active
    )
  }

  /**
   * Get count of completed operations
   */
  get completed(): number {
    return this.completedCount
  }

  /**
   * Get full queue statistics
   */
  getStats(): QueueStats {
    return {
      byPriority: {
        priority: {
          pending: this.queues.priority.length,
          active: this.semaphores.priority.active,
          completed: 0, // Would need per-tier tracking
        },
        standard: {
          pending: this.queues.standard.length,
          active: this.semaphores.standard.active,
          completed: 0,
        },
        flex: {
          pending: this.queues.flex.length,
          active: this.semaphores.flex.active,
          completed: 0,
        },
        batch: {
          pending: this.queues.batch.length,
          active: this.semaphores.batch.active,
          completed: 0,
        },
      },
      totals: {
        pending: this.pending,
        active: this.active,
        completed: this.completedCount,
        failed: this.failedCount,
      },
      batch: {
        size: this.queues.batch.length,
        nextFlush: this.batchTimer ? new Date(Date.now() + this.options.batchWindow) : null,
      },
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Stop the queue and clear all pending operations
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    this.queues.priority = []
    this.queues.standard = []
    this.queues.flex = []
    this.queues.batch = []

    setBatchScheduler(null)
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create an execution queue
 */
export function createExecutionQueue(options?: ExecutionQueueOptions): ExecutionQueue {
  return new ExecutionQueue(options)
}

// =============================================================================
// Default Instance
// =============================================================================

let defaultQueue: ExecutionQueue | null = null

/**
 * Get or create the default execution queue
 */
export function getDefaultQueue(): ExecutionQueue {
  if (!defaultQueue) {
    defaultQueue = createExecutionQueue()
  }
  return defaultQueue
}

/**
 * Set the default execution queue
 */
export function setDefaultQueue(queue: ExecutionQueue | null): void {
  defaultQueue = queue
}
