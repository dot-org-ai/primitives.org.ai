/**
 * In-Memory Batch Adapter for Testing
 *
 * Simulates batch processing locally for testing purposes.
 * Executes requests immediately (or with configurable delay).
 *
 * @packageDocumentation
 */

import {
  registerBatchAdapter,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
} from '../batch-queue.js'
import { generateObject, generateText } from '../generate.js'

// ============================================================================
// Types
// ============================================================================

interface MemoryBatch {
  id: string
  items: BatchItem[]
  options: BatchQueueOptions
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  results: BatchResult[]
  createdAt: Date
  completedAt?: Date
}

// ============================================================================
// Storage
// ============================================================================

const batches = new Map<string, MemoryBatch>()
let batchCounter = 0

/**
 * Options for the memory adapter
 */
export interface MemoryAdapterOptions {
  /** Simulate processing delay in ms */
  delay?: number
  /** Mock handler for custom processing */
  handler?: (item: BatchItem) => Promise<unknown>
  /** Simulate failure rate (0-1) */
  failureRate?: number
}

let memoryOptions: MemoryAdapterOptions = {}

/**
 * Configure the memory adapter
 */
export function configureMemoryAdapter(options: MemoryAdapterOptions): void {
  memoryOptions = options
}

/**
 * Clear all stored batches (for testing)
 */
export function clearBatches(): void {
  batches.clear()
  batchCounter = 0
}

/**
 * Get all stored batches (for testing)
 */
export function getBatches(): Map<string, MemoryBatch> {
  return batches
}

// ============================================================================
// Memory Batch Adapter
// ============================================================================

const memoryAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const batchId = `batch_memory_${++batchCounter}`

    const batch: MemoryBatch = {
      id: batchId,
      items: [...items],
      options,
      status: 'pending',
      results: [],
      createdAt: new Date(),
    }

    batches.set(batchId, batch)

    // Start processing asynchronously
    const completion = processMemoryBatch(batch)

    const job: BatchJob = {
      id: batchId,
      provider: 'openai', // Simulating OpenAI
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: batch.createdAt,
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const batch = batches.get(batchId)
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    const completedItems = batch.results.filter((r) => r.status === 'completed').length
    const failedItems = batch.results.filter((r) => r.status === 'failed').length

    return {
      id: batch.id,
      provider: 'openai',
      status:
        batch.status === 'completed'
          ? 'completed'
          : batch.status === 'failed'
          ? 'failed'
          : 'in_progress',
      totalItems: batch.items.length,
      completedItems,
      failedItems,
      createdAt: batch.createdAt,
      ...(batch.completedAt && { completedAt: batch.completedAt }),
    }
  },

  async cancel(batchId: string): Promise<void> {
    const batch = batches.get(batchId)
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`)
    }
    batch.status = 'failed'
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const batch = batches.get(batchId)
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`)
    }
    return batch.results
  },

  async waitForCompletion(batchId: string): Promise<BatchResult[]> {
    const batch = batches.get(batchId)
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    // Wait for completion
    while (batch.status !== 'completed' && batch.status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return batch.results
  },
}

// ============================================================================
// Processing
// ============================================================================

async function processMemoryBatch(batch: MemoryBatch): Promise<BatchResult[]> {
  batch.status = 'in_progress'

  // Optional delay
  if (memoryOptions.delay) {
    await new Promise((resolve) => setTimeout(resolve, memoryOptions.delay))
  }

  const results: BatchResult[] = []

  for (const item of batch.items) {
    try {
      // Simulate failure
      if (memoryOptions.failureRate && Math.random() < memoryOptions.failureRate) {
        throw new Error('Simulated failure')
      }

      let result: unknown

      if (memoryOptions.handler) {
        // Use custom handler
        result = await memoryOptions.handler(item)
      } else if (item.schema) {
        // Generate structured output
        const response = await generateObject({
          model: batch.options.model || 'sonnet',
          schema: item.schema,
          prompt: item.prompt,
          ...(item.options?.system !== undefined && { system: item.options.system }),
          ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
          ...(item.options?.maxTokens !== undefined && { maxTokens: item.options.maxTokens }),
        })
        result = response.object
      } else {
        // Generate text
        const response = await generateText({
          model: batch.options.model || 'sonnet',
          prompt: item.prompt,
          ...(item.options?.system !== undefined && { system: item.options.system }),
          ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
          ...(item.options?.maxTokens !== undefined && { maxTokens: item.options.maxTokens }),
        })
        result = response.text
      }

      results.push({
        id: item.id,
        customId: item.id,
        status: 'completed',
        result,
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
      })
    } catch (error) {
      results.push({
        id: item.id,
        customId: item.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  batch.results = results
  batch.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
  batch.completedAt = new Date()

  return results
}

// ============================================================================
// Register Adapter
// ============================================================================

registerBatchAdapter('openai', memoryAdapter)
registerBatchAdapter('anthropic', memoryAdapter)
registerBatchAdapter('google', memoryAdapter)
registerBatchAdapter('bedrock', memoryAdapter)
registerBatchAdapter('cloudflare', memoryAdapter)

export { memoryAdapter }
