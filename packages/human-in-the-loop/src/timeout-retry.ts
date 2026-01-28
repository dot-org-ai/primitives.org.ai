/**
 * Timeout/Retry strategies with exponential backoff for human-in-the-loop workflows
 *
 * Provides robust retry logic specifically designed for human tier operations,
 * which require longer delays and more patience than AI tier operations.
 */

import type { Priority } from './types.js'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for exponential backoff
 */
export interface BackoffConfig {
  /** Base delay in milliseconds */
  baseDelayMs: number
  /** Multiplier for each retry (default: 2) */
  multiplier?: number
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number
  /** Jitter factor (0-1) for randomization */
  jitterFactor?: number
}

/**
 * Configuration for retry policy
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number
  /** Error types that are retryable */
  retryableErrors?: string[]
  /** Callback when retries are exhausted */
  onExhausted?: (requestId: string, context: RetryExhaustedContext) => void | Promise<void>
}

/**
 * Context passed when retries are exhausted
 */
export interface RetryExhaustedContext {
  attempts: number
  lastError?: Error
  requestId: string
  duration: number
}

/**
 * Configuration for circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs?: number
  /** Time window in ms for counting failures */
  windowMs?: number
  /** Maximum attempts allowed in half-open state */
  halfOpenMaxAttempts?: number
}

/**
 * Configuration for SLA tracking
 */
export interface SLAConfig {
  /** Default deadline in milliseconds */
  deadlineMs?: number
  /** Warning threshold in milliseconds before deadline */
  warningThresholdMs?: number
  /** Callback when warning threshold is reached */
  onWarning?: (requestId: string, context: SLAWarningContext) => void
  /** Callback when SLA is violated */
  onViolation?: (requestId: string, context: SLAViolationContext) => void
  /** Priority-based SLA tiers */
  tiers?: Record<Priority, { deadlineMs: number }>
}

export interface SLAWarningContext {
  remainingMs: number
  deadline: Date
}

export interface SLAViolationContext {
  violatedAt: Date
  deadline: Date
  overdueMs: number
}

/**
 * Options for withRetry wrapper
 */
export interface WithRetryOptions<T = unknown> {
  /** Maximum number of retries */
  maxRetries: number
  /** Backoff configuration */
  backoff?: BackoffConfig
  /** Circuit breaker instance */
  circuitBreaker?: HumanCircuitBreaker
  /** SLA tracker instance */
  slaTracker?: SLATracker
  /** Request ID for SLA tracking */
  requestId?: string
  /** Callback when retries exhausted and escalation needed */
  onEscalate?: (context: EscalationContext) => T | Promise<T>
  /** Use escalation result instead of throwing */
  useEscalationResult?: boolean
}

export interface EscalationContext {
  attempts: number
  lastError: Error
  totalDuration: number
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when retries are exhausted
 */
export class RetryError extends Error {
  constructor(message: string, public readonly attempts: number, public readonly lastError: Error) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open - human tier is overwhelmed') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Error thrown when SLA is violated
 */
export class SLAViolationError extends Error {
  constructor(message: string, public readonly requestId: string, public readonly deadline: Date) {
    super(message)
    this.name = 'SLAViolationError'
  }
}

// ============================================================================
// ExponentialBackoff
// ============================================================================

/**
 * Exponential backoff calculator with human-tier defaults
 *
 * Human tier operations require longer delays than AI tier:
 * - Humans need time to read, think, and respond
 * - Business hours affect availability
 * - Context switching has higher cost for humans
 *
 * @example
 * ```ts
 * const backoff = ExponentialBackoff.forHumans()
 * const delay = backoff.getDelayWithJitter(attemptNumber)
 * await sleep(delay)
 * ```
 */
export class ExponentialBackoff {
  readonly config: Required<BackoffConfig>

  constructor(config: BackoffConfig) {
    this.config = {
      baseDelayMs: config.baseDelayMs,
      multiplier: config.multiplier ?? 2,
      maxDelayMs: config.maxDelayMs ?? Infinity,
      jitterFactor: config.jitterFactor ?? 0.1,
    }
  }

  /**
   * Create a backoff calculator with human-appropriate defaults
   * - Base delay: 1 minute (humans need time)
   * - Max delay: 1 hour (don't wait forever)
   * - Jitter: 10% to prevent thundering herd
   */
  static forHumans(overrides?: Partial<BackoffConfig>): ExponentialBackoff {
    return new ExponentialBackoff({
      baseDelayMs: 60000, // 1 minute
      maxDelayMs: 3600000, // 1 hour
      multiplier: 2,
      jitterFactor: 0.1,
      ...overrides,
    })
  }

  /**
   * Calculate delay for a given attempt number (0-indexed)
   */
  getDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.multiplier, attempt)
    return Math.min(delay, this.config.maxDelayMs)
  }

  /**
   * Calculate delay with random jitter applied
   */
  getDelayWithJitter(attempt: number): number {
    const baseDelay = this.getDelay(attempt)

    if (this.config.jitterFactor === 0) {
      return baseDelay
    }

    const jitterRange = baseDelay * this.config.jitterFactor
    const jitter = (Math.random() * 2 - 1) * jitterRange
    return Math.round(baseDelay + jitter)
  }
}

// ============================================================================
// HumanRetryPolicy
// ============================================================================

/**
 * Retry policy designed for human-tier operations
 *
 * Key differences from AI-tier retry:
 * - More retries allowed (humans may be busy)
 * - BUSY is always retryable (humans have other priorities)
 * - Tracks retry state per request
 *
 * @example
 * ```ts
 * const policy = HumanRetryPolicy.forHumans()
 * if (policy.shouldRetry(attemptNumber, error)) {
 *   // retry the request
 * }
 * ```
 */
export class HumanRetryPolicy {
  readonly config: Required<Omit<RetryConfig, 'onExhausted'>> & {
    onExhausted?: RetryConfig['onExhausted']
  }
  private attempts = new Map<string, number>()
  private startTimes = new Map<string, number>()

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: config.maxRetries,
      retryableErrors: config.retryableErrors ?? ['TIMEOUT', 'UNAVAILABLE', 'BUSY'],
      onExhausted: config.onExhausted,
    }
  }

  /**
   * Create a policy with human-appropriate defaults
   * - More retries (humans may be in meetings, etc.)
   * - BUSY is always retryable
   */
  static forHumans(overrides?: Partial<RetryConfig>): HumanRetryPolicy {
    return new HumanRetryPolicy({
      maxRetries: 5,
      retryableErrors: ['TIMEOUT', 'UNAVAILABLE', 'BUSY', 'AWAY', 'DO_NOT_DISTURB'],
      ...overrides,
    })
  }

  /**
   * Check if a retry should be attempted
   */
  shouldRetry(currentAttempt: number, error?: Error, overrides?: { maxRetries?: number }): boolean {
    const maxRetries = overrides?.maxRetries ?? this.config.maxRetries

    // Check attempt limit
    if (currentAttempt >= maxRetries) {
      return false
    }

    // If no error provided, just check the limit
    if (!error) {
      return true
    }

    // Check if error type is retryable
    const errorType = error.message
    return this.config.retryableErrors.some((retryable) => errorType.includes(retryable))
  }

  /**
   * Record an attempt for a request
   */
  recordAttempt(requestId: string): void {
    const current = this.attempts.get(requestId) ?? 0
    this.attempts.set(requestId, current + 1)

    if (!this.startTimes.has(requestId)) {
      this.startTimes.set(requestId, Date.now())
    }
  }

  /**
   * Record an attempt and trigger callbacks if exhausted
   */
  async recordAttemptAsync(requestId: string): Promise<void> {
    this.recordAttempt(requestId)

    if (this.isExhausted(requestId) && this.config.onExhausted) {
      const startTime = this.startTimes.get(requestId) ?? Date.now()
      await this.config.onExhausted(requestId, {
        attempts: this.attempts.get(requestId) ?? 0,
        requestId,
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Check if retries are exhausted for a request
   */
  isExhausted(requestId: string): boolean {
    const attempts = this.attempts.get(requestId) ?? 0
    return attempts > this.config.maxRetries
  }

  /**
   * Reset tracking for a request
   */
  reset(requestId: string): void {
    this.attempts.delete(requestId)
    this.startTimes.delete(requestId)
  }
}

// ============================================================================
// HumanCircuitBreaker
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half_open'

interface CircuitMetrics {
  failures: number
  successes: number
  state: CircuitState
  failureRate: number
  lastFailure?: Date
  lastSuccess?: Date
}

/**
 * Circuit breaker to protect overwhelmed human tier
 *
 * When too many requests fail (humans unavailable, timing out, etc.),
 * the circuit opens to prevent further requests and give humans time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, requests are blocked
 * - HALF_OPEN: Testing if humans are available again
 *
 * @example
 * ```ts
 * const breaker = new HumanCircuitBreaker({ failureThreshold: 5 })
 *
 * if (breaker.isOpen()) {
 *   throw new CircuitOpenError()
 * }
 *
 * try {
 *   await humanRequest()
 *   breaker.recordSuccess()
 * } catch (error) {
 *   breaker.recordFailure()
 *   throw error
 * }
 * ```
 */
export class HumanCircuitBreaker {
  private _state: CircuitState = 'closed'
  private failures = 0
  private successes = 0
  private lastStateChange = Date.now()
  private halfOpenAttempts = 0
  private lastFailure?: Date
  private lastSuccess?: Date

  readonly config: Required<CircuitBreakerConfig>

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs ?? 60000, // 1 minute default
      windowMs: config.windowMs ?? 60000, // 1 minute window
      halfOpenMaxAttempts: config.halfOpenMaxAttempts ?? 3,
    }
  }

  /**
   * Get current circuit state
   */
  get state(): CircuitState {
    // Auto-transition from open to half-open after timeout
    if (this._state === 'open') {
      const timeSinceOpen = Date.now() - this.lastStateChange
      if (timeSinceOpen >= this.config.resetTimeoutMs) {
        this._state = 'half_open'
        this.halfOpenAttempts = 0
        this.lastStateChange = Date.now()
      }
    }
    return this._state
  }

  /**
   * Record a failure
   */
  recordFailure(): void {
    this.failures++
    this.lastFailure = new Date()

    if (this._state === 'half_open') {
      // Failure in half-open state reopens the circuit
      this._state = 'open'
      this.lastStateChange = Date.now()
    } else if (this._state === 'closed') {
      // Check if we've hit the threshold
      if (this.failures >= this.config.failureThreshold) {
        this._state = 'open'
        this.lastStateChange = Date.now()
      }
    }
  }

  /**
   * Record a success
   */
  recordSuccess(): void {
    this.successes++
    this.lastSuccess = new Date()

    if (this._state === 'half_open') {
      // Success in half-open state closes the circuit
      this._state = 'closed'
      this.failures = 0
      this.lastStateChange = Date.now()
    }
  }

  /**
   * Check if circuit is open (requests should be blocked)
   */
  isOpen(): boolean {
    return this.state === 'open'
  }

  /**
   * Throw if circuit is open
   */
  throwIfOpen(): void {
    if (this.isOpen()) {
      throw new CircuitOpenError()
    }
  }

  /**
   * Check if an attempt can be made (for half-open state limiting)
   */
  canAttempt(): boolean {
    const currentState = this.state

    if (currentState === 'closed') {
      return true
    }

    if (currentState === 'half_open') {
      return this.halfOpenAttempts < this.config.halfOpenMaxAttempts
    }

    return false
  }

  /**
   * Record an attempt in half-open state
   */
  recordAttempt(): void {
    if (this.state === 'half_open') {
      this.halfOpenAttempts++
    }
  }

  /**
   * Check if humans are overwhelmed (high failure rate)
   */
  isOverwhelmed(): boolean {
    return this.state === 'open'
  }

  /**
   * Get failure rate (0-1)
   */
  getFailureRate(): number {
    const total = this.failures + this.successes
    if (total === 0) return 0
    return this.failures / total
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      failures: this.failures,
      successes: this.successes,
      state: this.state,
      failureRate: this.getFailureRate(),
      ...(this.lastFailure !== undefined && { lastFailure: this.lastFailure }),
      ...(this.lastSuccess !== undefined && { lastSuccess: this.lastSuccess }),
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this._state = 'closed'
    this.failures = 0
    this.successes = 0
    this.halfOpenAttempts = 0
    this.lastStateChange = Date.now()
    delete this.lastFailure
    delete this.lastSuccess
  }
}

// ============================================================================
// SLATracker
// ============================================================================

interface TrackedRequest {
  requestId: string
  deadline: Date
  priority?: Priority
  startedAt: Date
  completedAt?: Date
  violated: boolean
  warningEmitted: boolean
}

interface SLAMetrics {
  completed: number
  violated: number
  complianceRate: number
  averageCompletionMs?: number
}

/**
 * SLA tracker for monitoring human response deadlines
 *
 * Features:
 * - Deadline tracking per request
 * - Warning callbacks before deadline
 * - Violation callbacks after deadline
 * - Priority-based SLA tiers
 * - Compliance rate metrics
 *
 * @example
 * ```ts
 * const tracker = new SLATracker({
 *   deadlineMs: 300000, // 5 minutes
 *   warningThresholdMs: 60000, // Warn at 1 minute remaining
 *   onWarning: (id, ctx) => console.log(`SLA warning for ${id}`),
 *   onViolation: (id, ctx) => console.log(`SLA violated for ${id}`),
 * })
 *
 * tracker.track('req-1')
 * // ... later
 * if (tracker.isViolated('req-1')) {
 *   // Handle violation
 * }
 * tracker.complete('req-1')
 * ```
 */
export class SLATracker {
  readonly config: SLAConfig
  private requests = new Map<string, TrackedRequest>()
  private completedRequests: TrackedRequest[] = []
  private checkInterval?: ReturnType<typeof setInterval>

  constructor(config: SLAConfig) {
    this.config = config
    this.startChecking()
  }

  /**
   * Start tracking a request
   */
  track(
    requestId: string,
    options?: { priority?: Priority }
  ): { deadline: Date; remainingMs: number } {
    const now = new Date()
    const deadlineMs = this.getDeadlineForPriority(options?.priority)
    const deadline = new Date(now.getTime() + deadlineMs)

    const request: TrackedRequest = {
      requestId,
      deadline,
      ...(options?.priority !== undefined && { priority: options.priority }),
      startedAt: now,
      violated: false,
      warningEmitted: false,
    }

    this.requests.set(requestId, request)

    return {
      deadline,
      remainingMs: deadlineMs,
    }
  }

  /**
   * Get remaining time for a request
   */
  getRemainingTime(requestId: string): number {
    const request = this.requests.get(requestId)
    if (!request) {
      throw new Error(`Request ${requestId} not tracked`)
    }

    return Math.max(0, request.deadline.getTime() - Date.now())
  }

  /**
   * Check if SLA is violated for a request
   */
  isViolated(requestId: string): boolean {
    const request = this.requests.get(requestId)
    if (!request) {
      return false
    }

    const now = Date.now()
    if (now > request.deadline.getTime() && !request.violated) {
      request.violated = true
      this.emitViolation(request)
    }

    return request.violated
  }

  /**
   * Mark a request as completed
   */
  complete(requestId: string): void {
    const request = this.requests.get(requestId)
    if (!request) {
      return
    }

    request.completedAt = new Date()

    // Check for violation at completion time
    if (request.completedAt > request.deadline && !request.violated) {
      request.violated = true
    }

    this.completedRequests.push(request)
    this.requests.delete(requestId)
  }

  /**
   * Get SLA metrics
   */
  getMetrics(): SLAMetrics {
    const completed = this.completedRequests.length
    const violated = this.completedRequests.filter((r) => r.violated).length
    const complianceRate = completed > 0 ? (completed - violated) / completed : 1

    let averageCompletionMs: number | undefined
    if (completed > 0) {
      const totalMs = this.completedRequests.reduce((sum, r) => {
        if (r.completedAt) {
          return sum + (r.completedAt.getTime() - r.startedAt.getTime())
        }
        return sum
      }, 0)
      averageCompletionMs = totalMs / completed
    }

    return {
      completed,
      violated,
      complianceRate,
      ...(averageCompletionMs !== undefined && { averageCompletionMs }),
    }
  }

  /**
   * Stop tracking and cleanup
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
  }

  private getDeadlineForPriority(priority?: Priority): number {
    if (priority && this.config.tiers?.[priority]) {
      return this.config.tiers[priority].deadlineMs
    }
    return this.config.deadlineMs ?? 300000 // 5 minutes default
  }

  private startChecking(): void {
    // Check every second for warnings and violations
    this.checkInterval = setInterval(() => {
      const now = Date.now()

      for (const request of this.requests.values()) {
        const remaining = request.deadline.getTime() - now

        // Check for warning
        if (
          !request.warningEmitted &&
          this.config.warningThresholdMs &&
          remaining <= this.config.warningThresholdMs &&
          remaining > 0
        ) {
          request.warningEmitted = true
          this.emitWarning(request, remaining)
        }

        // Check for violation
        if (!request.violated && remaining <= 0) {
          request.violated = true
          this.emitViolation(request)
        }
      }
    }, 1000)
  }

  private emitWarning(request: TrackedRequest, remainingMs: number): void {
    if (this.config.onWarning) {
      this.config.onWarning(request.requestId, {
        remainingMs,
        deadline: request.deadline,
      })
    }
  }

  private emitViolation(request: TrackedRequest): void {
    if (this.config.onViolation) {
      this.config.onViolation(request.requestId, {
        violatedAt: new Date(),
        deadline: request.deadline,
        overdueMs: Date.now() - request.deadline.getTime(),
      })
    }
  }
}

// ============================================================================
// withRetry Wrapper
// ============================================================================

/**
 * Wrap an operation with retry logic, circuit breaker, and SLA tracking
 *
 * This is the main entry point for adding retry logic to human-tier operations.
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => human.ask({ question: 'What should we do?' }),
 *   {
 *     maxRetries: 3,
 *     backoff: { baseDelayMs: 60000 },
 *     onEscalate: (ctx) => escalateToManager(ctx),
 *   }
 * )
 * ```
 */
export async function withRetry<T>(
  operation: () => T | Promise<T>,
  options: WithRetryOptions<T>
): Promise<T> {
  const backoff = options.backoff
    ? new ExponentialBackoff(options.backoff)
    : ExponentialBackoff.forHumans()

  const startTime = Date.now()
  let lastError: Error | undefined
  let attempts = 0

  // Check circuit breaker before starting
  if (options.circuitBreaker?.isOpen()) {
    throw new CircuitOpenError()
  }

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    attempts++

    // Check SLA before each attempt
    if (options.slaTracker && options.requestId) {
      if (options.slaTracker.isViolated(options.requestId)) {
        const remaining = options.slaTracker.getRemainingTime(options.requestId)
        throw new SLAViolationError(
          `SLA violated for request ${options.requestId}`,
          options.requestId,
          new Date(Date.now() + remaining)
        )
      }
    }

    try {
      const result = await operation()

      // Record success to circuit breaker
      if (options.circuitBreaker) {
        options.circuitBreaker.recordSuccess()
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Record failure to circuit breaker
      if (options.circuitBreaker) {
        options.circuitBreaker.recordFailure()
      }

      // If this was the last attempt, don't wait
      if (attempt === options.maxRetries) {
        break
      }

      // Wait before next retry
      const delay = backoff.getDelayWithJitter(attempt)
      await sleep(delay)
    }
  }

  // Retries exhausted - try escalation
  if (options.onEscalate) {
    const escalationResult = await options.onEscalate({
      attempts,
      lastError: lastError!,
      totalDuration: Date.now() - startTime,
    })

    if (options.useEscalationResult) {
      return escalationResult
    }
  }

  throw new RetryError(`Operation failed after ${attempts} attempts`, attempts, lastError!)
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
