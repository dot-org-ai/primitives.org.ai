/**
 * Retry and fallback patterns for AI function calls
 *
 * Provides:
 * - Exponential backoff with configurable base delay and multiplier
 * - Jitter to prevent thundering herd (equal, full, decorrelated strategies)
 * - Circuit breaker for fail-fast behavior after repeated failures
 * - Fallback chains for model failover (sonnet -> opus -> gpt-4o)
 * - Error classification for intelligent retry decisions
 * - Partial retry for batch operations
 *
 * @packageDocumentation
 */

// ============================================================================
// ERROR TYPES AND CLASSIFICATION
// ============================================================================

/**
 * Error categories for retry decision making
 */
export enum ErrorCategory {
  /** Network connectivity issues (retryable) */
  Network = 'network',
  /** Rate limiting / quota exceeded (retryable with backoff) */
  RateLimit = 'rate_limit',
  /** Invalid input / bad request (not retryable) */
  InvalidInput = 'invalid_input',
  /** Authentication / authorization errors (not retryable) */
  Authentication = 'authentication',
  /** Server errors (retryable) */
  Server = 'server',
  /** Context length exceeded (not retryable without modification) */
  ContextLength = 'context_length',
  /** Unknown error type */
  Unknown = 'unknown',
}

/**
 * Base class for retryable errors
 */
export class RetryableError extends Error {
  readonly retryable = true
  readonly category: ErrorCategory

  constructor(message: string, category: ErrorCategory = ErrorCategory.Unknown) {
    super(message)
    this.name = 'RetryableError'
    this.category = category
  }
}

/**
 * Base class for non-retryable errors
 */
export class NonRetryableError extends Error {
  readonly retryable = false
  readonly category: ErrorCategory

  constructor(message: string, category: ErrorCategory = ErrorCategory.InvalidInput) {
    super(message)
    this.name = 'NonRetryableError'
    this.category = category
  }
}

/**
 * Network-related errors (connection issues, timeouts)
 */
export class NetworkError extends RetryableError {
  constructor(message: string) {
    super(message, ErrorCategory.Network)
    this.name = 'NetworkError'
  }
}

/**
 * Rate limit errors with optional retry-after
 */
export class RateLimitError extends RetryableError {
  readonly retryAfter?: number

  constructor(message: string, options?: { retryAfter?: number }) {
    super(message, ErrorCategory.RateLimit)
    this.name = 'RateLimitError'
    this.retryAfter = options?.retryAfter
  }

  /**
   * Create RateLimitError from HTTP response
   */
  static fromResponse(response: { status: number; headers?: Record<string, string> }): RateLimitError {
    const retryAfterHeader = response.headers?.['retry-after']
    let retryAfter: number | undefined

    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10)
      if (!isNaN(seconds)) {
        retryAfter = seconds * 1000 // Convert to milliseconds
      }
    }

    return new RateLimitError(`Rate limited (${response.status})`, { retryAfter })
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  readonly retryable = false

  constructor(message: string = 'Circuit breaker is open') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Classify an error into a category for retry decisions
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) {
    return ErrorCategory.Unknown
  }

  const message = error.message.toLowerCase()
  const status = (error as any).status as number | undefined

  // Network errors
  if (
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    message.includes('network request failed') ||
    message.includes('fetch failed')
  ) {
    return ErrorCategory.Network
  }

  // Rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded') ||
    status === 429
  ) {
    return ErrorCategory.RateLimit
  }

  // Invalid input errors
  if (
    message.includes('invalid json') ||
    message.includes('400 bad request') ||
    message.includes('validation failed') ||
    status === 400 ||
    status === 422
  ) {
    return ErrorCategory.InvalidInput
  }

  // Authentication errors
  if (
    message.includes('401 unauthorized') ||
    message.includes('403 forbidden') ||
    message.includes('invalid api key') ||
    status === 401 ||
    status === 403
  ) {
    return ErrorCategory.Authentication
  }

  // Server errors
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout') ||
    (status && status >= 500 && status < 600)
  ) {
    return ErrorCategory.Server
  }

  // Context length errors
  if (
    message.includes('context length') ||
    message.includes('token limit') ||
    message.includes('maximum context')
  ) {
    return ErrorCategory.ContextLength
  }

  return ErrorCategory.Unknown
}

// ============================================================================
// BACKOFF CALCULATION
// ============================================================================

/**
 * Jitter strategy for backoff calculation
 */
export type JitterStrategy = 'equal' | 'full' | 'decorrelated'

/**
 * Options for backoff calculation
 */
export interface BackoffOptions {
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelay?: number
  /** Exponential multiplier (default: 2) */
  multiplier?: number
  /** Jitter factor 0-1 for equal jitter (default: 0) */
  jitter?: number
  /** Jitter strategy (default: 'equal') */
  jitterStrategy?: JitterStrategy
  /** Previous delay for decorrelated jitter */
  previousDelay?: number
}

/**
 * Calculate backoff delay with exponential increase and optional jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, options: BackoffOptions = {}): number {
  const {
    baseDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    jitter = 0,
    jitterStrategy = 'equal',
    previousDelay,
  } = options

  // Calculate base exponential delay
  let delay = baseDelay * Math.pow(multiplier, attempt)

  // Apply jitter based on strategy
  if (jitterStrategy === 'full') {
    // Full jitter: random value between 0 and calculated delay
    delay = Math.random() * delay
  } else if (jitterStrategy === 'decorrelated' && previousDelay !== undefined) {
    // Decorrelated jitter: random between baseDelay and previousDelay * 3
    delay = baseDelay + Math.random() * (previousDelay * 3 - baseDelay)
  } else if (jitter > 0) {
    // Equal jitter: +/- jitter% of calculated delay
    const jitterRange = delay * jitter
    delay = delay - jitterRange + Math.random() * 2 * jitterRange
  }

  // Apply max delay cap
  return Math.min(delay, maxDelay)
}

// ============================================================================
// RETRY POLICY
// ============================================================================

/**
 * Options for retry policy
 */
export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelay?: number
  /** Exponential multiplier (default: 2) */
  multiplier?: number
  /** Jitter factor 0-1 (default: 0) */
  jitter?: number
  /** Jitter strategy (default: 'equal') */
  jitterStrategy?: JitterStrategy
  /** Respect retry-after headers from rate limit errors (default: true) */
  respectRetryAfter?: boolean
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown) => boolean
}

/**
 * Info passed to operations during retry
 */
export interface RetryInfo {
  attempt: number
  maxRetries: number
}

/**
 * Result of a batch item operation
 */
export interface BatchItemResult<T, R> {
  success: boolean
  item: T
  result?: R
  error?: Error
}

/**
 * Retry policy for executing operations with exponential backoff
 */
export class RetryPolicy {
  private readonly options: Required<Omit<RetryOptions, 'shouldRetry'>> & { shouldRetry?: (error: unknown) => boolean }

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      multiplier: options.multiplier ?? 2,
      jitter: options.jitter ?? 0,
      jitterStrategy: options.jitterStrategy ?? 'equal',
      respectRetryAfter: options.respectRetryAfter ?? true,
      shouldRetry: options.shouldRetry,
    }
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: (info: RetryInfo) => Promise<T>
  ): Promise<T> {
    let lastError: unknown
    let previousDelay = this.options.baseDelay

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await operation({ attempt, maxRetries: this.options.maxRetries })
      } catch (error) {
        lastError = error

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error
        }

        // Don't wait after the last attempt
        if (attempt === this.options.maxRetries) {
          break
        }

        // Calculate delay
        let delay = calculateBackoff(attempt, {
          baseDelay: this.options.baseDelay,
          maxDelay: this.options.maxDelay,
          multiplier: this.options.multiplier,
          jitter: this.options.jitter,
          jitterStrategy: this.options.jitterStrategy,
          previousDelay,
        })

        // Respect retry-after for rate limit errors
        if (this.options.respectRetryAfter && error instanceof RateLimitError && error.retryAfter) {
          delay = error.retryAfter
        }

        previousDelay = delay
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  /**
   * Execute a batch operation with partial retry for failed items
   */
  async executeBatch<T, R>(
    items: T[],
    batchProcessor: (items: T[]) => Promise<BatchItemResult<T, R>[]>
  ): Promise<BatchItemResult<T, R>[]> {
    const finalResults = new Map<T, BatchItemResult<T, R>>()
    let pendingItems = [...items]
    const attemptCounts = new Map<T, number>()

    // Initialize attempt counts
    items.forEach(item => attemptCounts.set(item, 0))

    for (let round = 0; round <= this.options.maxRetries && pendingItems.length > 0; round++) {
      // Wait before retry (not on first attempt)
      if (round > 0) {
        const delay = calculateBackoff(round - 1, {
          baseDelay: this.options.baseDelay,
          maxDelay: this.options.maxDelay,
          multiplier: this.options.multiplier,
          jitter: this.options.jitter,
          jitterStrategy: this.options.jitterStrategy,
        })
        await this.sleep(delay)
      }

      // Process current batch
      const results = await batchProcessor(pendingItems)

      // Separate successful and failed items
      const failedItems: T[] = []

      for (const result of results) {
        attemptCounts.set(result.item, (attemptCounts.get(result.item) || 0) + 1)

        if (result.success) {
          finalResults.set(result.item, result)
        } else {
          // Check if we can retry this item
          const attempts = attemptCounts.get(result.item) || 0
          if (attempts <= this.options.maxRetries && this.isRetryable(result.error)) {
            failedItems.push(result.item)
          } else {
            finalResults.set(result.item, result)
          }
        }
      }

      pendingItems = failedItems
    }

    // Return results in original order
    return items.map(item => finalResults.get(item)!)
  }

  private isRetryable(error: unknown): boolean {
    // Check custom shouldRetry function first
    if (this.options.shouldRetry) {
      return this.options.shouldRetry(error)
    }

    // Check error's own retryable property
    if (error && typeof error === 'object' && 'retryable' in error) {
      return (error as any).retryable === true
    }

    // Classify error and determine retryability
    const category = classifyError(error)
    return (
      category === ErrorCategory.Network ||
      category === ErrorCategory.RateLimit ||
      category === ErrorCategory.Server ||
      category === ErrorCategory.Unknown
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Options for circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number
  /** Time in ms before transitioning to half-open (default: 30000) */
  resetTimeout?: number
  /** Number of successful calls to close circuit (default: 1) */
  successThreshold?: number
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailure: Date | null
  lastSuccess: Date | null
  totalFailures: number
  totalSuccesses: number
}

/**
 * Circuit breaker for fail-fast behavior
 *
 * States:
 * - CLOSED: Normal operation, failures tracked
 * - OPEN: Fail fast, reject all requests
 * - HALF-OPEN: Allow single test request
 */
export class CircuitBreaker {
  private _state: CircuitState = 'closed'
  private _failureCount = 0
  private _successCount = 0
  private _lastFailure: Date | null = null
  private _lastSuccess: Date | null = null
  private _totalFailures = 0
  private _totalSuccesses = 0
  private _openedAt: number | null = null
  private readonly options: Required<CircuitBreakerOptions>

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      successThreshold: options.successThreshold ?? 1,
    }
  }

  /**
   * Current circuit state
   */
  get state(): CircuitState {
    // Check if we should transition from open to half-open
    if (this._state === 'open' && this._openedAt !== null) {
      if (Date.now() - this._openedAt >= this.options.resetTimeout) {
        this._state = 'half-open'
      }
    }
    return this._state
  }

  /**
   * Current failure count
   */
  get failureCount(): number {
    return this._failureCount
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check current state
    const currentState = this.state

    if (currentState === 'open') {
      throw new CircuitOpenError()
    }

    try {
      const result = await operation()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this._successCount++
    this._totalSuccesses++
    this._lastSuccess = new Date()
    this._failureCount = 0 // Reset failure count on success

    if (this._state === 'half-open') {
      if (this._successCount >= this.options.successThreshold) {
        this._state = 'closed'
        this._openedAt = null
      }
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this._failureCount++
    this._totalFailures++
    this._lastFailure = new Date()
    this._successCount = 0 // Reset success count on failure

    if (this._state === 'closed') {
      if (this._failureCount >= this.options.failureThreshold) {
        this._state = 'open'
        this._openedAt = Date.now()
      }
    } else if (this._state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this._state = 'open'
      this._openedAt = Date.now()
    }
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this._failureCount,
      successCount: this._successCount,
      lastFailure: this._lastFailure,
      lastSuccess: this._lastSuccess,
      totalFailures: this._totalFailures,
      totalSuccesses: this._totalSuccesses,
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this._state = 'closed'
    this._failureCount = 0
    this._successCount = 0
    this._openedAt = null
  }
}

// ============================================================================
// FALLBACK CHAIN
// ============================================================================

/**
 * A model in the fallback chain
 */
export interface FallbackModel<T = unknown, P = unknown> {
  name: string
  execute: (params?: P) => Promise<T>
}

/**
 * Options for fallback chain
 */
export interface FallbackOptions {
  /** Custom function to determine if fallback should be attempted */
  shouldFallback?: (error: unknown) => boolean
}

/**
 * Metrics from fallback chain execution
 */
export interface FallbackMetrics {
  attempts: number
  successfulModel: string | null
  failedModels: string[]
  totalDuration: number
  errors: Array<{ model: string; error: Error }>
}

/**
 * Fallback chain for model failover
 *
 * Tries models in order until one succeeds:
 * sonnet -> opus -> gpt-4o -> gemini
 */
export class FallbackChain<T = unknown, P = unknown> {
  private readonly models: FallbackModel<T, P>[]
  private readonly options: FallbackOptions
  private lastMetrics: FallbackMetrics | null = null

  constructor(models: FallbackModel<T, P>[], options: FallbackOptions = {}) {
    if (models.length === 0) {
      throw new Error('FallbackChain requires at least one model')
    }
    this.models = models
    this.options = options
  }

  /**
   * Execute the fallback chain
   */
  async execute(params?: P): Promise<T> {
    const startTime = Date.now()
    const failedModels: string[] = []
    const errors: Array<{ model: string; error: Error }> = []

    for (const model of this.models) {
      try {
        const result = await model.execute(params)

        this.lastMetrics = {
          attempts: failedModels.length + 1,
          successfulModel: model.name,
          failedModels,
          totalDuration: Date.now() - startTime,
          errors,
        }

        return result
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        failedModels.push(model.name)
        errors.push({ model: model.name, error: err })

        // Check if we should attempt fallback
        if (this.options.shouldFallback && !this.options.shouldFallback(error)) {
          this.lastMetrics = {
            attempts: failedModels.length,
            successfulModel: null,
            failedModels,
            totalDuration: Date.now() - startTime,
            errors,
          }
          throw error
        }
      }
    }

    this.lastMetrics = {
      attempts: this.models.length,
      successfulModel: null,
      failedModels,
      totalDuration: Date.now() - startTime,
      errors,
    }

    throw new Error('All fallback models failed')
  }

  /**
   * Get metrics from the last execution
   */
  getMetrics(): FallbackMetrics {
    if (!this.lastMetrics) {
      return {
        attempts: 0,
        successfulModel: null,
        failedModels: [],
        totalDuration: 0,
        errors: [],
      }
    }
    return this.lastMetrics
  }
}

// ============================================================================
// CONVENIENCE HELPER
// ============================================================================

/**
 * Wrap an async function with retry logic
 *
 * @example
 * ```ts
 * const reliableFetch = withRetry(fetch, {
 *   maxRetries: 3,
 *   baseDelay: 1000,
 *   jitter: 0.2,
 * })
 *
 * const response = await reliableFetch('https://api.example.com')
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  const policy = new RetryPolicy(options)

  return (async (...args: Parameters<T>) => {
    return policy.execute(() => fn(...args))
  }) as T
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { RetryOptions as RetryPolicyOptions }
