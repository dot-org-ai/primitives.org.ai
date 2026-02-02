/**
 * Worker Export - WorkerEntrypoint for RPC access to AI Props
 *
 * Exposes AI props generation methods via Cloudflare RPC.
 * Provides schema-based prop generation, caching, validation,
 * and cascade execution patterns.
 *
 * ## Features
 *
 * - **RPC Service**: WorkerEntrypoint for service binding access
 * - **Cascade Execution**: Code -> Generative -> Agentic -> Human escalation
 * - **Durable Cascades**: Cloudflare Workflows integration for durability
 * - **AI Gateway**: Configuration helpers for Cloudflare AI Gateway
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "AI_PROPS", "service": "ai-props" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.AI_PROPS.connect()
 *     const result = await service.generate({
 *       schema: { title: 'Page title', description: 'Page description' },
 *       context: { topic: 'AI' }
 *     })
 *     return Response.json(result.props)
 *   }
 * }
 * ```
 *
 * ## Cascade Pattern
 *
 * @example
 * ```typescript
 * import {
 *   DurableCascadeExecutor,
 *   createDurableCascadeStep,
 *   createAIGatewayConfig
 * } from 'ai-props/worker'
 *
 * // Create a durable cascade for content generation
 * const contentCascade = createDurableCascadeStep({
 *   name: 'generate-content',
 *   code: async (input) => {
 *     if (input.template) return { content: input.template }
 *     throw new Error('No template available')
 *   },
 *   generative: async (input, ctx) => {
 *     const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
 *       messages: [{ role: 'user', content: `Generate content about: ${input.topic}` }]
 *     })
 *     return { content: result.response }
 *   }
 * })
 *
 * // In a Cloudflare Workflow
 * const result = await contentCascade.run(step, { topic: 'AI' })
 * console.log(result.tier) // 'code' or 'generative'
 * ```
 *
 * @packageDocumentation
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
import type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  AIPropsConfig,
  PropsCache,
  PropsCacheEntry,
  ValidationResult,
} from './types.js'
import {
  generateProps,
  getPropsSync,
  prefetchProps,
  generatePropsMany,
  mergeWithGenerated,
  configureAIProps,
  getConfig,
  resetConfig,
} from './generate.js'
import {
  MemoryPropsCache,
  LRUPropsCache,
  createCacheKey,
  getDefaultCache,
  configureCache,
  clearCache,
} from './cache.js'
import {
  validateProps,
  hasRequiredProps,
  getMissingFromSchema,
  isComplete,
  sanitizeProps,
  mergeWithDefaults,
} from './validate.js'

/**
 * Environment bindings for the worker
 */
export interface Env {
  AI?: unknown
}

/**
 * PropsServiceCore - RpcTarget wrapper for AI props functionality
 *
 * Exposes all required methods as RPC-callable methods.
 * This is the core service class that can be instantiated directly.
 */
export class PropsServiceCore extends RpcTarget {
  private cache: MemoryPropsCache

  constructor() {
    super()
    this.cache = getDefaultCache()
  }

  // ==================== Generation ====================

  /**
   * Generate props using AI
   *
   * @example
   * ```ts
   * const result = await service.generate({
   *   schema: {
   *     title: 'A compelling page title',
   *     description: 'A brief description',
   *   },
   *   context: { topic: 'AI-powered applications' },
   * })
   * ```
   */
  async generate<T = Record<string, unknown>>(
    options: GeneratePropsOptions
  ): Promise<GeneratePropsResult<T>> {
    return generateProps<T>(options)
  }

  /**
   * Generate props synchronously from cache
   *
   * @throws {Error} If props are not in cache
   */
  getSync<T = Record<string, unknown>>(schema: PropSchema, context?: Record<string, unknown>): T {
    return getPropsSync<T>(schema, context)
  }

  /**
   * Pre-generate props for warming the cache
   */
  async prefetch(requests: GeneratePropsOptions[]): Promise<void> {
    return prefetchProps(requests)
  }

  /**
   * Generate multiple prop sets in parallel
   */
  async generateMany<T = Record<string, unknown>>(
    requests: GeneratePropsOptions[]
  ): Promise<GeneratePropsResult<T>[]> {
    return generatePropsMany<T>(requests)
  }

  /**
   * Merge partial props with generated props
   *
   * Generates only the missing props, keeping provided ones.
   */
  async mergeWithGenerated<T extends Record<string, unknown>>(
    schema: PropSchema,
    partialProps: Partial<T>,
    options?: Omit<GeneratePropsOptions, 'schema' | 'context'>
  ): Promise<T> {
    return mergeWithGenerated<T>(schema, partialProps, options)
  }

  // ==================== Configuration ====================

  /**
   * Configure global AI props settings
   */
  configure(config: Partial<AIPropsConfig>): void {
    configureAIProps(config)
  }

  /**
   * Get current configuration
   */
  getConfig(): AIPropsConfig {
    return getConfig()
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    resetConfig()
  }

  // ==================== Cache Operations ====================

  /**
   * Get cached props by key
   */
  getCached<T>(key: string): PropsCacheEntry<T> | undefined {
    return this.cache.get<T>(key)
  }

  /**
   * Set props in cache
   */
  setCached<T>(key: string, props: T): void {
    this.cache.set(key, props)
  }

  /**
   * Delete cached entry by key
   */
  deleteCached(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cached props
   */
  clearCache(): void {
    clearCache()
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size
  }

  /**
   * Create a cache key from schema and context
   */
  createCacheKey(schema: PropSchema, context?: Record<string, unknown>): string {
    return createCacheKey(schema, context)
  }

  /**
   * Configure cache TTL
   */
  configureCache(ttl: number): void {
    configureCache(ttl)
    this.cache = getDefaultCache()
  }

  // ==================== Validation ====================

  /**
   * Validate props against a schema
   */
  validate(props: Record<string, unknown>, schema: PropSchema): ValidationResult {
    return validateProps(props, schema)
  }

  /**
   * Check if all required props are present
   */
  hasRequired(props: Record<string, unknown>, required: string[]): boolean {
    return hasRequiredProps(props, required)
  }

  /**
   * Get list of missing props according to schema
   */
  getMissing(props: Record<string, unknown>, schema: PropSchema): string[] {
    return getMissingFromSchema(props, schema)
  }

  /**
   * Check if props are complete according to schema
   */
  isComplete(props: Record<string, unknown>, schema: PropSchema): boolean {
    return isComplete(props, schema)
  }

  /**
   * Sanitize props by removing unknown keys
   */
  sanitize<T extends Record<string, unknown>>(props: T, schema: PropSchema): Partial<T> {
    return sanitizeProps(props, schema)
  }

  /**
   * Merge props with default values
   */
  mergeDefaults<T extends Record<string, unknown>>(
    props: Partial<T>,
    defaults: Partial<T>,
    schema: PropSchema
  ): Partial<T> {
    return mergeWithDefaults(props, defaults, schema)
  }
}

/**
 * PropsService - WorkerEntrypoint for RPC access
 *
 * Provides `connect()` method that returns an RpcTarget service
 * with all AI props methods. Also handles HTTP endpoints for
 * direct JSON-RPC access.
 *
 * @example
 * ```typescript
 * // In consuming worker
 * const service = env.AI_PROPS.connect()
 * const result = await service.generate({
 *   schema: { title: 'Page title' }
 * })
 * ```
 */
export class PropsService extends WorkerEntrypoint<Env> {
  private serviceCore: PropsServiceCore | null = null

  /**
   * Get or create the service core instance
   */
  private getServiceCore(): PropsServiceCore {
    if (!this.serviceCore) {
      this.serviceCore = new PropsServiceCore()
    }
    return this.serviceCore
  }

  /**
   * Get a connected service instance for RPC calls
   *
   * Note: Named 'getService' instead of 'connect' because 'connect'
   * is a reserved method name in Cloudflare Workers RPC (used for sockets).
   *
   * @returns PropsServiceCore instance for RPC calls
   */
  getService(): PropsServiceCore {
    return this.getServiceCore()
  }

  /**
   * Alias for getService() - provides the connect() interface
   * Note: This may conflict with the Fetcher's connect() for sockets
   * when accessed via service bindings. Use getService() instead.
   *
   * @deprecated Use getService() instead
   * @returns PropsServiceCore instance for RPC calls
   */
  connect(): PropsServiceCore {
    return this.getServiceCore()
  }

  /**
   * HTTP request handler for JSON-RPC and service info endpoints
   *
   * Routes:
   * - GET / - Returns service info
   * - POST /rpc - JSON-RPC endpoint for calling service methods
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // GET / - Service info
    if (request.method === 'GET' && url.pathname === '/') {
      const service = this.getServiceCore()
      return Response.json({
        name: 'ai-props',
        version: '1.0.0',
        methods: [
          'generate',
          'getSync',
          'prefetch',
          'generateMany',
          'mergeWithGenerated',
          'configure',
          'getConfig',
          'resetConfig',
          'getCached',
          'setCached',
          'deleteCached',
          'clearCache',
          'getCacheSize',
          'createCacheKey',
          'configureCache',
          'validate',
          'hasRequired',
          'getMissing',
          'isComplete',
          'sanitize',
          'mergeDefaults',
        ],
        rpc: '/rpc',
      })
    }

    // POST /rpc - JSON-RPC endpoint
    if (url.pathname === '/rpc' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { method: string; args?: unknown[] }
        const { method, args = [] } = body

        if (!method || typeof method !== 'string') {
          return Response.json({ error: 'Missing or invalid method' }, { status: 400 })
        }

        const service = this.getServiceCore()

        // Check if method exists on service
        const methodFn = (service as unknown as Record<string, unknown>)[method]
        if (typeof methodFn !== 'function') {
          return Response.json({ error: `Method "${method}" not found` }, { status: 404 })
        }

        // Call the method
        const result = await (methodFn as (...args: unknown[]) => unknown).apply(service, args)
        return Response.json({ result })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return Response.json({ error: message }, { status: 500 })
      }
    }

    // 404 for other routes
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

/**
 * Default export for Cloudflare Workers
 */
export default PropsService

/**
 * Export aliases
 */
export { PropsService as PropsWorker }

// =============================================================================
// Cascade Execution - Code -> Generative -> Agentic -> Human pattern
// =============================================================================

export {
  // Base cascade (non-durable)
  CascadeExecutor,
  createCascadeStep,
  // Types
  type CascadeConfig,
  type CascadeResult,
  type CascadeContext,
  type TierContext,
  type TierHandler,
  type TierResult,
  type CapabilityTier,
  type FiveWHEvent,
  type TierRetryConfig,
  type SkipCondition,
  type CascadeMetrics,
  type CascadeStep,
  // Constants
  TIER_ORDER,
  DEFAULT_TIER_TIMEOUTS,
  // Errors
  CascadeTimeoutError,
  TierSkippedError,
  AllTiersFailedError,
  // Helpers
  createCascadeContext,
  recordStep,
} from './cascade.js'

// =============================================================================
// Durable Cascade - Cloudflare Workflows integration
// =============================================================================

export {
  // Durable cascade executor
  DurableCascadeExecutor,
  createDurableCascadeStep,
  // AI Gateway configuration
  createAIGatewayConfig,
  // Types
  type DurableCascadeConfig,
  type DurableCascadeTierContext,
  type DurableStepConfig,
  type DurableRetryConfig,
  type WorkflowStep,
  type AiBinding,
  type HumanReviewRequest,
  type AIGatewayConfig,
  type CodeTierHandler,
  type AiTierHandler,
  type HumanTierHandler,
} from './durable-cascade.js'

// =============================================================================
// Event System - Queue-based event handling
// =============================================================================

/**
 * Event System exports for Queue-based event handling
 *
 * @example
 * ```typescript
 * import { EventBridge, createQueueHandler } from 'ai-props/worker'
 *
 * const bridge = new EventBridge(env.MY_QUEUE)
 * bridge.on('user.created', async (data) => {
 *   console.log('User created:', data.id)
 * })
 *
 * export default {
 *   async fetch(request, env) {
 *     await bridge.emit('user.created', { id: '123' })
 *     return new Response('OK')
 *   },
 *   async queue(batch, env) {
 *     const handler = createQueueHandler(bridge)
 *     await handler.queue(batch, env)
 *   }
 * }
 * ```
 */
export {
  EventBridge,
  createQueueHandler,
  createEventBridge,
  type QueuedEvent,
  type EventBridgeConfig,
  type EventHandler,
  type EmitOptions,
  type Queue,
  type QueueMessage,
  type MessageBatch,
  type TypedEventBridge,
} from './event-bridge.js'
