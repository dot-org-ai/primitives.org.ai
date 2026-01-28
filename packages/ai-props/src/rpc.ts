/**
 * RPC Export - Cloudflare Workers RPC utilities for AI Props
 *
 * This module provides RPC-specific functionality for consuming the AI Props
 * service via Cloudflare Workers Service Bindings. It exports the service
 * classes, types, and utilities for building RPC clients.
 *
 * ## RPC Pattern Overview
 *
 * Cloudflare Workers RPC allows direct method invocation between workers
 * using Service Bindings. The AI Props service exposes methods through:
 *
 * 1. **WorkerEntrypoint** (`PropsService`) - The main entry point that workers
 *    bind to. Provides `getService()` to get an RPC-callable service instance.
 *
 * 2. **RpcTarget** (`PropsServiceCore`) - The actual service implementation
 *    with all callable methods. Returned by `getService()`.
 *
 * ## Usage Patterns
 *
 * ### Basic Service Binding
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "AI_PROPS", "service": "ai-props" }
 *   ]
 * }
 *
 * // worker.ts
 * import type { PropsService } from 'ai-props/rpc'
 *
 * interface Env {
 *   AI_PROPS: Service<PropsService>
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.AI_PROPS.getService()
 *     const result = await service.generate({
 *       schema: { title: 'Page title' }
 *     })
 *     return Response.json(result)
 *   }
 * }
 * ```
 *
 * ### With Typed Client Factory
 * ```typescript
 * import { createPropsClient, type PropsClientOptions } from 'ai-props/rpc'
 *
 * const client = createPropsClient({
 *   service: env.AI_PROPS,
 *   timeout: 30000,
 *   retry: { attempts: 3, backoff: 'exponential' }
 * })
 *
 * const result = await client.generate({
 *   schema: { title: 'Page title' }
 * })
 * ```
 *
 * ### Error Handling
 * ```typescript
 * import { PropsRPCError, isPropsRPCError } from 'ai-props/rpc'
 *
 * try {
 *   const result = await service.generate(options)
 * } catch (error) {
 *   if (isPropsRPCError(error)) {
 *     console.error(`RPC Error: ${error.code} - ${error.message}`)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export service classes from worker
export { PropsService, PropsServiceCore, PropsWorker } from './worker.js'

// Re-export types needed for RPC usage
export type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  AIPropsConfig,
  PropsCache,
  PropsCacheEntry,
  ValidationResult,
  ValidationError,
} from './types.js'

// Re-export Env type
export type { Env } from './worker.js'

// ==================== RPC Error Types ====================

/**
 * Error codes for RPC operations
 */
export enum PropsRPCErrorCode {
  /** Method not found on service */
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  /** Invalid arguments passed to method */
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  /** Service connection failed */
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  /** Request timed out */
  TIMEOUT = 'TIMEOUT',
  /** Service returned an error */
  SERVICE_ERROR = 'SERVICE_ERROR',
  /** Network error during RPC call */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error for RPC failures
 *
 * Provides detailed error information for debugging RPC issues.
 *
 * @example
 * ```typescript
 * try {
 *   await service.generate(options)
 * } catch (error) {
 *   if (error instanceof PropsRPCError) {
 *     console.error(`[${error.code}] ${error.message}`)
 *     if (error.cause) console.error('Caused by:', error.cause)
 *   }
 * }
 * ```
 */
export class PropsRPCError extends Error {
  /** Error code for programmatic handling */
  readonly code: PropsRPCErrorCode
  /** Original error that caused this RPC error */
  readonly originalCause: Error | undefined
  /** Method that was being called */
  readonly method: string | undefined
  /** Timestamp when error occurred */
  readonly timestamp: number

  constructor(
    message: string,
    code: PropsRPCErrorCode = PropsRPCErrorCode.UNKNOWN,
    options?: { cause?: Error; method?: string }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = 'PropsRPCError'
    this.code = code
    this.originalCause = options?.cause
    this.method = options?.method
    this.timestamp = Date.now()
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      method: this.method,
      timestamp: this.timestamp,
      cause: this.originalCause?.message,
    }
  }
}

/**
 * Type guard to check if an error is a PropsRPCError
 */
export function isPropsRPCError(error: unknown): error is PropsRPCError {
  return error instanceof PropsRPCError
}

// ==================== Retry Configuration ====================

/**
 * Retry backoff strategy
 */
export type RetryBackoff = 'linear' | 'exponential' | 'fixed'

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Number of retry attempts (default: 3) */
  attempts?: number
  /** Backoff strategy (default: 'exponential') */
  backoff?: RetryBackoff
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number
  /** Multiplier for exponential backoff (default: 2) */
  multiplier?: number
  /** Error codes to retry on (default: CONNECTION_FAILED, TIMEOUT, NETWORK_ERROR) */
  retryOn?: PropsRPCErrorCode[]
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  attempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  retryOn: [
    PropsRPCErrorCode.CONNECTION_FAILED,
    PropsRPCErrorCode.TIMEOUT,
    PropsRPCErrorCode.NETWORK_ERROR,
  ],
}

/**
 * Calculate delay for retry attempt based on backoff strategy
 */
export function calculateRetryDelay(attempt: number, config: Required<RetryConfig>): number {
  let delay: number

  switch (config.backoff) {
    case 'fixed':
      delay = config.initialDelay
      break
    case 'linear':
      delay = config.initialDelay * attempt
      break
    case 'exponential':
    default:
      delay = config.initialDelay * Math.pow(config.multiplier, attempt - 1)
      break
  }

  return Math.min(delay, config.maxDelay)
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 *
 * Wraps an async function with configurable retry behavior including
 * exponential backoff, maximum attempts, and error code filtering.
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => service.generate(options),
 *   { attempts: 3, backoff: 'exponential' }
 * )
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, config?: RetryConfig): Promise<T> {
  const fullConfig: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }

  let lastError: Error | undefined
  let attempt = 0

  while (attempt < fullConfig.attempts) {
    attempt++

    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry this error
      const shouldRetry =
        attempt < fullConfig.attempts &&
        (isPropsRPCError(error) ? fullConfig.retryOn.includes(error.code) : true)

      if (!shouldRetry) {
        throw error
      }

      // Calculate and wait for delay
      const delay = calculateRetryDelay(attempt, fullConfig)
      await sleep(delay)
    }
  }

  throw lastError
}

// ==================== Client Factory ====================

/**
 * Options for creating a Props RPC client
 */
export interface PropsClientOptions<Env = unknown> {
  /**
   * The service binding from the worker environment
   *
   * @example
   * ```typescript
   * const client = createPropsClient({ service: env.AI_PROPS })
   * ```
   */
  service: {
    getService(): PropsServiceCoreInterface
  }
  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number
  /**
   * Retry configuration
   */
  retry?: RetryConfig
  /**
   * Called before each RPC call
   */
  onRequest?: (method: string, args: unknown[]) => void
  /**
   * Called after each RPC call
   */
  onResponse?: (method: string, result: unknown, duration: number) => void
  /**
   * Called when an RPC call fails
   */
  onError?: (method: string, error: Error) => void
}

/**
 * Interface matching PropsServiceCore methods
 * Used for typing the client without importing the class
 */
export interface PropsServiceCoreInterface {
  generate<T = Record<string, unknown>>(
    options: GeneratePropsOptions
  ): Promise<GeneratePropsResult<T>>
  getSync<T = Record<string, unknown>>(schema: PropSchema, context?: Record<string, unknown>): T
  prefetch(requests: GeneratePropsOptions[]): Promise<void>
  generateMany<T = Record<string, unknown>>(
    requests: GeneratePropsOptions[]
  ): Promise<GeneratePropsResult<T>[]>
  mergeWithGenerated<T extends Record<string, unknown>>(
    schema: PropSchema,
    partialProps: Partial<T>,
    options?: Omit<GeneratePropsOptions, 'schema' | 'context'>
  ): Promise<T>
  configure(config: Partial<AIPropsConfig>): void
  getConfig(): AIPropsConfig
  resetConfig(): void
  getCached<T>(key: string): PropsCacheEntry<T> | undefined
  setCached<T>(key: string, props: T): void
  deleteCached(key: string): boolean
  clearCache(): void
  getCacheSize(): number
  createCacheKey(schema: PropSchema, context?: Record<string, unknown>): string
  configureCache(ttl: number): void
  validate(props: Record<string, unknown>, schema: PropSchema): ValidationResult
  hasRequired(props: Record<string, unknown>, required: string[]): boolean
  getMissing(props: Record<string, unknown>, schema: PropSchema): string[]
  isComplete(props: Record<string, unknown>, schema: PropSchema): boolean
  sanitize<T extends Record<string, unknown>>(props: T, schema: PropSchema): Partial<T>
  mergeDefaults<T extends Record<string, unknown>>(
    props: Partial<T>,
    defaults: Partial<T>,
    schema: PropSchema
  ): Partial<T>
}

// Import types for re-export
import type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  AIPropsConfig,
  PropsCacheEntry,
  ValidationResult,
} from './types.js'

/**
 * Props client instance with wrapped methods
 */
export interface PropsClientInstance extends PropsServiceCoreInterface {
  /**
   * Get the underlying service instance
   */
  getUnderlyingService(): PropsServiceCoreInterface
}

/**
 * Create a typed Props RPC client with optional retry and monitoring
 *
 * Wraps the service binding with timeout handling, retry logic, and
 * lifecycle hooks for monitoring.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const client = createPropsClient({ service: env.AI_PROPS })
 * const result = await client.generate({ schema: { title: 'Page title' } })
 *
 * // With retry and monitoring
 * const client = createPropsClient({
 *   service: env.AI_PROPS,
 *   timeout: 30000,
 *   retry: { attempts: 3, backoff: 'exponential' },
 *   onRequest: (method, args) => console.log(`Calling ${method}`),
 *   onResponse: (method, result, duration) =>
 *     console.log(`${method} completed in ${duration}ms`),
 *   onError: (method, error) => console.error(`${method} failed:`, error)
 * })
 * ```
 */
export function createPropsClient(options: PropsClientOptions): PropsClientInstance {
  const { service, timeout = 30000, retry, onRequest, onResponse, onError } = options

  // Get the underlying service instance
  const serviceInstance = service.getService()

  /**
   * Wrap a method with timeout, retry, and hooks
   */
  function wrapMethod<TArgs extends unknown[], TResult>(
    methodName: string,
    method: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const startTime = Date.now()

      // Call onRequest hook
      onRequest?.(methodName, args)

      const executeCall = async (): Promise<TResult> => {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new PropsRPCError(`Request timed out after ${timeout}ms`, PropsRPCErrorCode.TIMEOUT, {
                method: methodName,
              })
            )
          }, timeout)
        })

        // Race between call and timeout
        try {
          return await Promise.race([method.apply(serviceInstance, args), timeoutPromise])
        } catch (error) {
          // Convert to PropsRPCError if not already
          if (!isPropsRPCError(error)) {
            const message = error instanceof Error ? error.message : String(error)
            const errorCause = error instanceof Error ? error : undefined
            throw new PropsRPCError(
              message,
              PropsRPCErrorCode.SERVICE_ERROR,
              errorCause ? { cause: errorCause, method: methodName } : { method: methodName }
            )
          }
          throw error
        }
      }

      try {
        // Execute with optional retry
        const result = retry ? await withRetry(executeCall, retry) : await executeCall()

        // Call onResponse hook
        const duration = Date.now() - startTime
        onResponse?.(methodName, result, duration)

        return result
      } catch (error) {
        // Call onError hook
        onError?.(methodName, error instanceof Error ? error : new Error(String(error)))
        throw error
      }
    }
  }

  /**
   * Wrap a synchronous method (just adds hooks, no timeout/retry)
   */
  function wrapSyncMethod<TArgs extends unknown[], TResult>(
    methodName: string,
    method: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      const startTime = Date.now()
      onRequest?.(methodName, args)

      try {
        const result = method.apply(serviceInstance, args)
        const duration = Date.now() - startTime
        onResponse?.(methodName, result, duration)
        return result
      } catch (error) {
        onError?.(methodName, error instanceof Error ? error : new Error(String(error)))
        throw error
      }
    }
  }

  // Create wrapped client with type assertions to preserve generics
  const client: PropsClientInstance = {
    // Async methods with timeout/retry
    generate: wrapMethod(
      'generate',
      serviceInstance.generate.bind(serviceInstance)
    ) as PropsClientInstance['generate'],
    prefetch: wrapMethod('prefetch', serviceInstance.prefetch.bind(serviceInstance)),
    generateMany: wrapMethod(
      'generateMany',
      serviceInstance.generateMany.bind(serviceInstance)
    ) as PropsClientInstance['generateMany'],
    mergeWithGenerated: wrapMethod(
      'mergeWithGenerated',
      serviceInstance.mergeWithGenerated.bind(serviceInstance)
    ) as PropsClientInstance['mergeWithGenerated'],

    // Sync methods (just hooks)
    getSync: wrapSyncMethod(
      'getSync',
      serviceInstance.getSync.bind(serviceInstance)
    ) as PropsClientInstance['getSync'],
    configure: wrapSyncMethod('configure', serviceInstance.configure.bind(serviceInstance)),
    getConfig: wrapSyncMethod('getConfig', serviceInstance.getConfig.bind(serviceInstance)),
    resetConfig: wrapSyncMethod('resetConfig', serviceInstance.resetConfig.bind(serviceInstance)),
    getCached: wrapSyncMethod(
      'getCached',
      serviceInstance.getCached.bind(serviceInstance)
    ) as PropsClientInstance['getCached'],
    setCached: wrapSyncMethod(
      'setCached',
      serviceInstance.setCached.bind(serviceInstance)
    ) as PropsClientInstance['setCached'],
    deleteCached: wrapSyncMethod(
      'deleteCached',
      serviceInstance.deleteCached.bind(serviceInstance)
    ),
    clearCache: wrapSyncMethod('clearCache', serviceInstance.clearCache.bind(serviceInstance)),
    getCacheSize: wrapSyncMethod(
      'getCacheSize',
      serviceInstance.getCacheSize.bind(serviceInstance)
    ),
    createCacheKey: wrapSyncMethod(
      'createCacheKey',
      serviceInstance.createCacheKey.bind(serviceInstance)
    ),
    configureCache: wrapSyncMethod(
      'configureCache',
      serviceInstance.configureCache.bind(serviceInstance)
    ),
    validate: wrapSyncMethod('validate', serviceInstance.validate.bind(serviceInstance)),
    hasRequired: wrapSyncMethod('hasRequired', serviceInstance.hasRequired.bind(serviceInstance)),
    getMissing: wrapSyncMethod('getMissing', serviceInstance.getMissing.bind(serviceInstance)),
    isComplete: wrapSyncMethod('isComplete', serviceInstance.isComplete.bind(serviceInstance)),
    sanitize: wrapSyncMethod(
      'sanitize',
      serviceInstance.sanitize.bind(serviceInstance)
    ) as PropsClientInstance['sanitize'],
    mergeDefaults: wrapSyncMethod(
      'mergeDefaults',
      serviceInstance.mergeDefaults.bind(serviceInstance)
    ) as PropsClientInstance['mergeDefaults'],

    // Utility method
    getUnderlyingService: () => serviceInstance,
  }

  return client
}

// ==================== Utility Types ====================

/**
 * Extract the service type from an environment binding
 *
 * @example
 * ```typescript
 * interface Env {
 *   AI_PROPS: Service<PropsService>
 * }
 *
 * type ServiceType = ExtractService<Env['AI_PROPS']>
 * // ServiceType = PropsService
 * ```
 */
export type ExtractService<T> = T extends { getService(): infer S } ? S : never

/**
 * Type for a Service Binding to PropsService
 *
 * Use this in your Env interface for proper typing.
 *
 * @example
 * ```typescript
 * interface Env {
 *   AI_PROPS: PropsServiceBinding
 * }
 * ```
 */
export interface PropsServiceBinding {
  getService(): PropsServiceCoreInterface
  fetch(request: Request): Promise<Response>
}
