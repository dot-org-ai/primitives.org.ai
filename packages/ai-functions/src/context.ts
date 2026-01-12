/**
 * Execution Context for AI Functions
 *
 * This module extends the core context from @org.ai/core with batch processing
 * and budget tracking features. It re-exports core context functions to provide
 * a single source of truth for context management.
 *
 * Settings flow from environment → global context → local context.
 *
 * @example
 * ```ts
 * // Set global defaults (from environment or initialization)
 * configure({
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4-20250514',
 *   batchMode: 'auto', // 'auto' | 'immediate' | 'deferred'
 * })
 *
 * // Or use execution context for specific operations
 * await withContext({ provider: 'openai', model: 'gpt-4o' }, async () => {
 *   const titles = await list`10 blog titles`
 *   return titles.map(title => write`blog post: ${title}`)
 * })
 * ```
 *
 * @packageDocumentation
 */

// Re-export core context management from @org.ai/core
// This ensures a single source of truth for globalContext and AsyncLocalStorage
import {
  configure as coreConfigure,
  getContext as coreGetContext,
  withContext as coreWithContext,
  getGlobalContext as coreGetGlobalContext,
  resetContext as coreResetContext,
  getModel,
  getProvider as coreGetProvider,
  type ExecutionContext as CoreExecutionContext,
} from '@org.ai/core'

import type { BatchProvider } from './batch-queue.js'
import type { RequestContext as IRequestContext, ModelPricing } from './budget.js'

// ============================================================================
// Extended Types for Batch Processing
// ============================================================================

/** Batch execution mode */
export type BatchMode =
  | 'auto'       // Smart selection: immediate < flexThreshold, flex < batchThreshold, batch above
  | 'immediate'  // Execute immediately (concurrent requests, full price)
  | 'flex'       // Use flex processing (faster than batch, ~50% discount, minutes)
  | 'deferred'   // Always use provider batch API (50% discount, up to 24hr)

/** Budget configuration for context */
export interface ContextBudgetConfig {
  /** Maximum total tokens allowed */
  maxTokens?: number
  /** Maximum cost in USD */
  maxCost?: number
  /** Alert thresholds as fractions (e.g., [0.5, 0.8, 1.0]) */
  alertThresholds?: number[]
  /** Custom pricing for models not in default pricing table */
  customPricing?: Record<string, ModelPricing>
}

/**
 * Extended execution context with batch processing and budget features.
 * Extends the core ExecutionContext from @org.ai/core.
 */
export interface ExecutionContext extends CoreExecutionContext {
  /** Batch provider to use (typed more strictly than core's string provider) */
  provider?: BatchProvider
  /** Batch execution mode */
  batchMode?: BatchMode
  /** Minimum items to use flex processing (for 'auto' mode, default: 5) */
  flexThreshold?: number
  /** Minimum items to use batch API (for 'auto' mode, default: 500) */
  batchThreshold?: number
  /** Webhook URL for batch completion notifications */
  webhookUrl?: string
  /** Custom metadata for batch jobs */
  metadata?: Record<string, unknown>
  /** Budget configuration for tracking and limits */
  budget?: ContextBudgetConfig
  /** Request context for tracing */
  requestContext?: IRequestContext
}

// ============================================================================
// Re-export Core Context Functions (with Extended Types)
// ============================================================================

/**
 * Configure global defaults for AI functions
 *
 * @example
 * ```ts
 * configure({
 *   model: 'claude-sonnet-4-20250514',
 *   provider: 'anthropic',
 *   batchMode: 'auto',
 *   batchThreshold: 5,
 * })
 * ```
 */
export function configure(context: ExecutionContext): void {
  coreConfigure(context)
}

/**
 * Get the current global context
 */
export function getGlobalContext(): ExecutionContext {
  return coreGetGlobalContext() as ExecutionContext
}

/**
 * Reset global context to defaults
 */
export function resetContext(): void {
  coreResetContext()
}

/**
 * Get the current execution context
 * Merges: environment defaults → global context → local context
 */
export function getContext(): ExecutionContext {
  const ctx = coreGetContext() as ExecutionContext

  // Add batch-specific environment defaults
  const envBatchContext = getEnvBatchContext()

  return {
    ...envBatchContext,
    ...ctx,
  }
}

/**
 * Run a function with a specific execution context
 *
 * @example
 * ```ts
 * const posts = await withContext({ provider: 'openai', batchMode: 'deferred' }, async () => {
 *   const titles = await list`10 blog titles`
 *   return titles.map(title => write`blog post: ${title}`)
 * })
 * ```
 */
export function withContext<T>(
  context: ExecutionContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return coreWithContext(context, fn)
}

// Re-export getModel unchanged
export { getModel }

/**
 * Get the effective provider from context (typed as BatchProvider)
 */
export function getProvider(): BatchProvider {
  return coreGetProvider() as BatchProvider
}

// ============================================================================
// Batch-Specific Environment Defaults
// ============================================================================

function getEnvBatchContext(): Partial<ExecutionContext> {
  if (typeof process === 'undefined') return {}

  const context: Partial<ExecutionContext> = {}

  // Batch mode
  if (process.env.AI_BATCH_MODE) {
    context.batchMode = process.env.AI_BATCH_MODE as BatchMode
  }

  // Flex threshold (when to start using flex processing)
  if (process.env.AI_FLEX_THRESHOLD) {
    context.flexThreshold = parseInt(process.env.AI_FLEX_THRESHOLD, 10)
  }

  // Batch threshold (when to switch from flex to full batch)
  if (process.env.AI_BATCH_THRESHOLD) {
    context.batchThreshold = parseInt(process.env.AI_BATCH_THRESHOLD, 10)
  }

  // Webhook URL
  if (process.env.AI_BATCH_WEBHOOK_URL) {
    context.webhookUrl = process.env.AI_BATCH_WEBHOOK_URL
  }

  return context
}

// ============================================================================
// Batch-Specific Context Helpers
// ============================================================================

/**
 * Get the effective batch mode from context
 */
export function getBatchMode(): BatchMode {
  const ctx = getContext()
  return ctx.batchMode || 'auto'
}

/**
 * Get the flex threshold from context (minimum items to use flex)
 * Default: 5 items
 */
export function getFlexThreshold(): number {
  const ctx = getContext()
  return ctx.flexThreshold || 5
}

/**
 * Get the batch threshold from context (minimum items to use full batch)
 * Default: 500 items
 */
export function getBatchThreshold(): number {
  const ctx = getContext()
  return ctx.batchThreshold || 500
}

/** Execution tier for processing */
export type ExecutionTier = 'immediate' | 'flex' | 'batch'

/**
 * Determine the execution tier for a given number of items
 *
 * Auto mode tiers:
 * - immediate: < flexThreshold (default 5) - concurrent requests, full price
 * - flex: flexThreshold to batchThreshold (5-500) - ~50% discount, minutes
 * - batch: >= batchThreshold (500+) - 50% discount, up to 24hr
 *
 * @example
 * ```ts
 * getExecutionTier(3)   // 'immediate' (< 5)
 * getExecutionTier(50)  // 'flex' (5-500)
 * getExecutionTier(1000) // 'batch' (500+)
 * ```
 */
export function getExecutionTier(itemCount: number): ExecutionTier {
  const mode = getBatchMode()

  switch (mode) {
    case 'immediate':
      return 'immediate'
    case 'flex':
      return 'flex'
    case 'deferred':
      return 'batch'
    case 'auto':
    default: {
      const flexThreshold = getFlexThreshold()
      const batchThreshold = getBatchThreshold()

      if (itemCount < flexThreshold) {
        return 'immediate'
      } else if (itemCount < batchThreshold) {
        return 'flex'
      } else {
        return 'batch'
      }
    }
  }
}

/**
 * Check if we should use the batch API for a given number of items
 *
 * @deprecated Use {@link getExecutionTier} instead for more granular control.
 * This function will be removed in a future major version.
 *
 * @param itemCount - Number of items to process
 * @returns true if batch or flex tier should be used, false for immediate
 *
 * @example
 * ```ts
 * // Deprecated usage:
 * if (shouldUseBatchAPI(items.length)) { ... }
 *
 * // Recommended:
 * const tier = getExecutionTier(items.length)
 * if (tier === 'batch' || tier === 'flex') { ... }
 * ```
 */
export function shouldUseBatchAPI(itemCount: number): boolean {
  const tier = getExecutionTier(itemCount)
  return tier === 'flex' || tier === 'batch'
}

/**
 * Check if flex processing is available for the current provider
 * Only OpenAI and AWS Bedrock support flex processing currently
 */
export function isFlexAvailable(): boolean {
  const provider = getProvider()
  return provider === 'openai' || provider === 'bedrock' || provider === 'google'
}
