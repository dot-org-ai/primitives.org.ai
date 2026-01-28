/**
 * Worker Export - WorkerEntrypoint for RPC access to AI Props
 *
 * Exposes AI props generation methods via Cloudflare RPC.
 * Provides schema-based prop generation, caching, and validation.
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
 * with all AI props methods.
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
  /**
   * Connect to the props service and get an RPC-enabled service
   *
   * @returns PropsServiceCore instance for RPC calls
   */
  connect(): PropsServiceCore {
    return new PropsServiceCore()
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
