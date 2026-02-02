/**
 * RPC Client for AI Props
 *
 * Provides a typed RPC client that connects to the deployed
 * ai-props worker using rpc.do for remote procedure calls.
 *
 * This module is for client-side usage - it provides types and
 * helpers for consuming the PropsService worker from other workers
 * or client applications.
 *
 * @example
 * ```ts
 * import { createPropsClient } from 'ai-props/client'
 *
 * const client = createPropsClient('https://ai-props.workers.dev')
 * const result = await client.generate({
 *   schema: { title: 'Page title', description: 'Page description' },
 *   context: { topic: 'AI' }
 * })
 * console.log(result.props)
 * ```
 *
 * @packageDocumentation
 */

// ==================== Re-export Types ====================

// Re-export core types needed for client usage
export type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  AIPropsConfig,
  PropsCache,
  PropsCacheEntry,
  ValidationResult,
  ValidationError,
  UseAIPropsResult,
  UseAIPropsOptions,
  AIComponentOptions,
  AIComponent,
  InferProps,
} from './types.js'

// Re-export RPC types from rpc.ts
export type {
  PropsServiceCoreInterface,
  PropsClientOptions,
  PropsClientInstance,
  PropsRPCErrorCode,
  PropsRPCError,
  RetryConfig,
  RetryBackoff,
  PropsServiceBinding,
  ExtractService,
} from './rpc.js'

export { isPropsRPCError, withRetry, calculateRetryDelay, DEFAULT_RETRY_CONFIG } from './rpc.js'

// ==================== HTTP Client Types ====================

/**
 * Configuration for the AI Props HTTP RPC client
 */
export interface PropsHttpClientConfig {
  /** RPC endpoint URL (default: https://ai-props.do) */
  url?: string
  /** Authentication token */
  token?: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client API Interface ====================

import type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  AIPropsConfig,
  PropsCacheEntry,
  ValidationResult,
} from './types.js'

/**
 * PropsClientAPI - Type-safe interface for the AI Props RPC client
 *
 * This interface mirrors all public methods on PropsServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface PropsClientAPI {
  // ==================== Generation ====================

  /**
   * Generate props using AI
   */
  generate<T = Record<string, unknown>>(
    options: GeneratePropsOptions
  ): Promise<GeneratePropsResult<T>>

  /**
   * Generate props synchronously from cache
   * @throws {Error} If props are not in cache
   */
  getSync<T = Record<string, unknown>>(
    schema: PropSchema,
    context?: Record<string, unknown>
  ): Promise<T>

  /**
   * Pre-generate props for warming the cache
   */
  prefetch(requests: GeneratePropsOptions[]): Promise<void>

  /**
   * Generate multiple prop sets in parallel
   */
  generateMany<T = Record<string, unknown>>(
    requests: GeneratePropsOptions[]
  ): Promise<GeneratePropsResult<T>[]>

  /**
   * Merge partial props with generated props
   */
  mergeWithGenerated<T extends Record<string, unknown>>(
    schema: PropSchema,
    partialProps: Partial<T>,
    options?: Omit<GeneratePropsOptions, 'schema' | 'context'>
  ): Promise<T>

  // ==================== Configuration ====================

  /**
   * Configure global AI props settings
   */
  configure(config: Partial<AIPropsConfig>): Promise<void>

  /**
   * Get current configuration
   */
  getConfig(): Promise<AIPropsConfig>

  /**
   * Reset configuration to defaults
   */
  resetConfig(): Promise<void>

  // ==================== Cache Operations ====================

  /**
   * Get cached props by key
   */
  getCached<T>(key: string): Promise<PropsCacheEntry<T> | undefined>

  /**
   * Set props in cache
   */
  setCached<T>(key: string, props: T): Promise<void>

  /**
   * Delete cached entry by key
   */
  deleteCached(key: string): Promise<boolean>

  /**
   * Clear all cached props
   */
  clearCache(): Promise<void>

  /**
   * Get cache size
   */
  getCacheSize(): Promise<number>

  /**
   * Create a cache key from schema and context
   */
  createCacheKey(schema: PropSchema, context?: Record<string, unknown>): Promise<string>

  /**
   * Configure cache TTL
   */
  configureCache(ttl: number): Promise<void>

  // ==================== Validation ====================

  /**
   * Validate props against a schema
   */
  validate(props: Record<string, unknown>, schema: PropSchema): Promise<ValidationResult>

  /**
   * Check if all required props are present
   */
  hasRequired(props: Record<string, unknown>, required: string[]): Promise<boolean>

  /**
   * Get list of missing props according to schema
   */
  getMissing(props: Record<string, unknown>, schema: PropSchema): Promise<string[]>

  /**
   * Check if props are complete according to schema
   */
  isComplete(props: Record<string, unknown>, schema: PropSchema): Promise<boolean>

  /**
   * Sanitize props by removing unknown keys
   */
  sanitize<T extends Record<string, unknown>>(props: T, schema: PropSchema): Promise<Partial<T>>

  /**
   * Merge props with default values
   */
  mergeDefaults<T extends Record<string, unknown>>(
    props: Partial<T>,
    defaults: Partial<T>,
    schema: PropSchema
  ): Promise<Partial<T>>
}

// ==================== HTTP Client Implementation ====================

/** Default URL for the ai-props worker */
const DEFAULT_URL = 'https://ai-props.do'

/**
 * Create a typed HTTP RPC client for the ai-props worker
 *
 * This client communicates with the deployed ai-props worker over HTTP,
 * sending JSON-RPC requests to the /rpc endpoint.
 *
 * @param config - Client configuration options
 * @returns A typed RPC client with all PropsService methods
 *
 * @example Basic usage
 * ```ts
 * import { createPropsClient } from 'ai-props/client'
 *
 * const client = createPropsClient({
 *   url: 'https://ai-props.workers.dev',
 *   token: 'my-api-token'
 * })
 *
 * // Generate props
 * const result = await client.generate({
 *   schema: { title: 'Page title', description: 'Description' },
 *   context: { topic: 'Technology' }
 * })
 * console.log(result.props)
 *
 * // Validate props
 * const validation = await client.validate(
 *   { title: 'Hello' },
 *   { title: 'string', description: 'string' }
 * )
 * console.log(validation.valid) // false - missing description
 * ```
 *
 * @example With custom headers
 * ```ts
 * const client = createPropsClient({
 *   url: 'https://ai-props.workers.dev',
 *   headers: {
 *     'X-Custom-Header': 'value',
 *   },
 *   timeout: 60000, // 60 seconds
 * })
 * ```
 */
export function createPropsClient(config: PropsHttpClientConfig = {}): PropsClientAPI {
  const url = config.url || DEFAULT_URL
  const timeout = config.timeout || 30000

  /**
   * Make an RPC call to the remote service
   */
  async function rpc<T>(method: string, args: unknown[] = []): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${url}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.token && { Authorization: `Bearer ${config.token}` }),
          ...config.headers,
        },
        body: JSON.stringify({ method, args }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((error as { error?: string }).error || `RPC error: ${response.status}`)
      }

      const result = (await response.json()) as { result: T; error?: string }

      if (result.error) {
        throw new Error(result.error)
      }

      return result.result
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Build client with typed methods
  return {
    // Generation
    generate: <T>(options: GeneratePropsOptions) =>
      rpc<GeneratePropsResult<T>>('generate', [options]),

    getSync: <T>(schema: PropSchema, context?: Record<string, unknown>) =>
      rpc<T>('getSync', [schema, context]),

    prefetch: (requests: GeneratePropsOptions[]) => rpc<void>('prefetch', [requests]),

    generateMany: <T>(requests: GeneratePropsOptions[]) =>
      rpc<GeneratePropsResult<T>[]>('generateMany', [requests]),

    mergeWithGenerated: <T extends Record<string, unknown>>(
      schema: PropSchema,
      partialProps: Partial<T>,
      options?: Omit<GeneratePropsOptions, 'schema' | 'context'>
    ) => rpc<T>('mergeWithGenerated', [schema, partialProps, options]),

    // Configuration
    configure: (cfg: Partial<AIPropsConfig>) => rpc<void>('configure', [cfg]),

    getConfig: () => rpc<AIPropsConfig>('getConfig'),

    resetConfig: () => rpc<void>('resetConfig'),

    // Cache
    getCached: <T>(key: string) => rpc<PropsCacheEntry<T> | undefined>('getCached', [key]),

    setCached: <T>(key: string, props: T) => rpc<void>('setCached', [key, props]),

    deleteCached: (key: string) => rpc<boolean>('deleteCached', [key]),

    clearCache: () => rpc<void>('clearCache'),

    getCacheSize: () => rpc<number>('getCacheSize'),

    createCacheKey: (schema: PropSchema, context?: Record<string, unknown>) =>
      rpc<string>('createCacheKey', [schema, context]),

    configureCache: (ttl: number) => rpc<void>('configureCache', [ttl]),

    // Validation
    validate: (props: Record<string, unknown>, schema: PropSchema) =>
      rpc<ValidationResult>('validate', [props, schema]),

    hasRequired: (props: Record<string, unknown>, required: string[]) =>
      rpc<boolean>('hasRequired', [props, required]),

    getMissing: (props: Record<string, unknown>, schema: PropSchema) =>
      rpc<string[]>('getMissing', [props, schema]),

    isComplete: (props: Record<string, unknown>, schema: PropSchema) =>
      rpc<boolean>('isComplete', [props, schema]),

    sanitize: <T extends Record<string, unknown>>(props: T, schema: PropSchema) =>
      rpc<Partial<T>>('sanitize', [props, schema]),

    mergeDefaults: <T extends Record<string, unknown>>(
      props: Partial<T>,
      defaults: Partial<T>,
      schema: PropSchema
    ) => rpc<Partial<T>>('mergeDefaults', [props, defaults, schema]),
  }
}

// ==================== Service Binding Client ====================

/**
 * Create a typed client from a Cloudflare Service Binding
 *
 * Use this when you have a service binding to the ai-props worker
 * in your wrangler.jsonc configuration.
 *
 * @param binding - The service binding from your env
 * @returns A typed client interface
 *
 * @example
 * ```ts
 * // wrangler.jsonc
 * // {
 * //   "services": [
 * //     { "binding": "AI_PROPS", "service": "ai-props" }
 * //   ]
 * // }
 *
 * import { createServiceClient } from 'ai-props/client'
 * import type { PropsService } from 'ai-props/worker'
 *
 * interface Env {
 *   AI_PROPS: Service<PropsService>
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const client = createServiceClient(env.AI_PROPS)
 *     const result = await client.generate({
 *       schema: { title: 'Page title' }
 *     })
 *     return Response.json(result)
 *   }
 * }
 * ```
 */
export function createServiceClient<T extends { getService(): unknown }>(
  binding: T
): ReturnType<T['getService']> {
  return binding.getService() as ReturnType<T['getService']>
}

// ==================== Default Export ====================

/**
 * Default client instance connected to the production ai-props worker
 *
 * @example
 * ```ts
 * import client from 'ai-props/client'
 *
 * const result = await client.generate({
 *   schema: { title: 'Page title' }
 * })
 * ```
 */
const client: PropsClientAPI = createPropsClient()

export default client
