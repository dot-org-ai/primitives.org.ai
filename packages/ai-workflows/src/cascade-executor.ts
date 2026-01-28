/**
 * CascadeExecutor - Code -> Generative -> Agentic -> Human escalation pattern
 *
 * Implements a tiered execution strategy that tries deterministic code first,
 * then escalates to AI-powered solutions, and finally to human-in-the-loop
 * if all automated approaches fail.
 *
 * Features:
 * - Tier escalation on failure
 * - Per-tier and total cascade timeouts
 * - 5W+H event emission for audit trails
 * - Context propagation through tiers
 * - Retry support per tier
 * - Custom skip conditions
 *
 * @packageDocumentation
 */

import {
  createCascadeContext,
  recordStep,
  type CascadeContext,
  type FiveWHEvent,
  type StepStatus,
} from './cascade-context.js'

// ============================================================================
// Constants
// ============================================================================

/**
 * Ordered list of capability tiers
 */
export const TIER_ORDER = ['code', 'generative', 'agentic', 'human'] as const

/**
 * Default timeouts per tier (from capability-tiers)
 */
export const DEFAULT_TIER_TIMEOUTS: Record<CapabilityTier, number> = {
  code: 5000, // 5 seconds
  generative: 30000, // 30 seconds
  agentic: 300000, // 5 minutes
  human: 86400000, // 24 hours
}

// ============================================================================
// Types
// ============================================================================

/**
 * Capability tier levels
 */
export type CapabilityTier = 'code' | 'generative' | 'agentic' | 'human'

/**
 * Context passed to tier handlers
 */
export interface TierContext {
  /** Correlation ID for tracing */
  correlationId: string
  /** Current tier being executed */
  tier: CapabilityTier
  /** Input data */
  input: unknown
  /** Cascade context */
  cascadeContext: CascadeContext
}

/**
 * Handler for a specific tier
 */
export interface TierHandler<T = unknown> {
  /** Handler name for debugging */
  name: string
  /** Execute the tier logic */
  execute: (input: unknown, context: TierContext) => Promise<T>
}

/**
 * Retry configuration per tier
 */
export interface TierRetryConfig {
  /** Maximum number of retries */
  maxRetries: number
  /** Base delay in milliseconds */
  baseDelay: number
  /** Multiplier for exponential backoff */
  multiplier?: number
}

/**
 * Result from a single tier execution
 */
export interface TierResult {
  /** Tier that was executed */
  tier: CapabilityTier
  /** Whether the tier succeeded */
  success: boolean
  /** Result value (if success) */
  value?: unknown
  /** Error (if failure) */
  error?: Error
  /** Whether the tier timed out */
  timedOut?: boolean
  /** Duration in milliseconds */
  duration: number
}

/**
 * Metrics from cascade execution
 */
export interface CascadeMetrics {
  /** Total execution duration */
  totalDuration: number
  /** Duration per tier */
  tierDurations: Partial<Record<CapabilityTier, number>>
  /** Number of retries per tier */
  tierRetries?: Partial<Record<CapabilityTier, number>>
}

/**
 * Result from cascade execution
 */
export interface CascadeResult<T = unknown> {
  /** Final result value */
  value: T
  /** Tier that produced the result */
  tier: CapabilityTier
  /** History of all tier executions */
  history: TierResult[]
  /** Tiers that were skipped */
  skippedTiers: CapabilityTier[]
  /** Cascade context with tracing info */
  context: CascadeContext
  /** Execution metrics */
  metrics: CascadeMetrics
}

/**
 * Skip condition function
 */
export type SkipCondition = (input: unknown) => boolean

/**
 * Configuration for CascadeExecutor
 */
export interface CascadeConfig<T = unknown> {
  /** Tier handlers */
  tiers: Partial<Record<CapabilityTier, TierHandler<T>>>
  /** Per-tier timeouts in milliseconds */
  timeouts?: Partial<Record<CapabilityTier, number>>
  /** Total cascade timeout in milliseconds */
  totalTimeout?: number
  /** Use default timeouts from capability-tiers */
  useDefaultTimeouts?: boolean
  /** Actor identifier for 5W+H events */
  actor?: string
  /** Cascade name for 5W+H events */
  cascadeName?: string
  /** Event callback for 5W+H events */
  onEvent?: (event: FiveWHEvent) => void
  /** Skip conditions per tier */
  skipConditions?: Partial<Record<CapabilityTier, SkipCondition>>
  /** Retry configuration per tier */
  retryConfig?: Partial<Record<CapabilityTier, TierRetryConfig>>
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when cascade times out
 */
export class CascadeTimeoutError extends Error {
  public readonly timeout: number
  public readonly elapsed: number

  constructor(timeout: number, elapsed: number) {
    super(`Cascade timed out after ${elapsed}ms (limit: ${timeout}ms)`)
    this.name = 'CascadeTimeoutError'
    this.timeout = timeout
    this.elapsed = elapsed
  }
}

/**
 * Error thrown when a tier is skipped
 */
export class TierSkippedError extends Error {
  public readonly tier: CapabilityTier
  public readonly reason: string

  constructor(tier: CapabilityTier, reason: string) {
    super(`Tier '${tier}' was skipped: ${reason}`)
    this.name = 'TierSkippedError'
    this.tier = tier
    this.reason = reason
  }
}

/**
 * Error thrown when all tiers fail
 */
export class AllTiersFailedError extends Error {
  public readonly history: TierResult[]

  constructor(history: TierResult[]) {
    super('All cascade tiers failed')
    this.name = 'AllTiersFailedError'
    this.history = history
  }
}

// ============================================================================
// CascadeExecutor
// ============================================================================

/**
 * CascadeExecutor implements the code -> generative -> agentic -> human pattern
 */
export class CascadeExecutor<T = unknown> {
  private readonly config: CascadeConfig<T>
  private readonly actor: string
  private readonly cascadeName: string

  constructor(config: CascadeConfig<T>) {
    this.config = config
    this.actor = config.actor || 'system'
    this.cascadeName = config.cascadeName || 'cascade'
  }

  /**
   * Execute the cascade
   */
  async execute(input: unknown): Promise<CascadeResult<T>> {
    const startTime = Date.now()
    const context = createCascadeContext({ name: this.cascadeName })
    const history: TierResult[] = []
    const skippedTiers: CapabilityTier[] = []
    const tierDurations: Partial<Record<CapabilityTier, number>> = {}

    // Emit cascade start event
    this.emitEvent({
      who: this.actor,
      what: 'cascade-start',
      when: startTime,
      where: this.cascadeName,
      how: {
        status: 'running',
        metadata: { input },
      },
    })

    // Set up total timeout if configured
    let totalTimeoutId: ReturnType<typeof setTimeout> | undefined
    let totalTimedOut = false

    const totalTimeoutPromise = new Promise<never>((_, reject) => {
      if (this.config.totalTimeout) {
        totalTimeoutId = setTimeout(() => {
          totalTimedOut = true
          reject(new CascadeTimeoutError(this.config.totalTimeout!, Date.now() - startTime))
        }, this.config.totalTimeout)
      }
    })

    try {
      // Execute tiers in order
      for (const tier of TIER_ORDER) {
        if (totalTimedOut) break

        const handler = this.config.tiers[tier]

        // Check if tier should be skipped
        if (!handler) {
          skippedTiers.push(tier)
          continue
        }

        // Check skip condition
        const skipCondition = this.config.skipConditions?.[tier]
        if (skipCondition && skipCondition(input)) {
          skippedTiers.push(tier)
          continue
        }

        // Execute tier
        const tierResult = await this.executeTier(
          tier,
          handler,
          input,
          context,
          startTime,
          totalTimeoutPromise
        )

        history.push(tierResult)
        tierDurations[tier] = tierResult.duration

        // If tier succeeded, we're done
        if (tierResult.success && tierResult.value !== undefined) {
          if (totalTimeoutId) clearTimeout(totalTimeoutId)

          const endTime = Date.now()
          this.emitEvent({
            who: this.actor,
            what: 'cascade-complete',
            when: endTime,
            where: this.cascadeName,
            how: {
              status: 'completed',
              duration: endTime - startTime,
              metadata: { tier, value: tierResult.value },
            },
          })

          return {
            value: tierResult.value as T,
            tier,
            history,
            skippedTiers,
            context,
            metrics: {
              totalDuration: endTime - startTime,
              tierDurations,
            },
          }
        }
      }

      // Check if we timed out
      if (totalTimedOut) {
        if (totalTimeoutId) clearTimeout(totalTimeoutId)
        throw new CascadeTimeoutError(this.config.totalTimeout!, Date.now() - startTime)
      }

      // All tiers failed
      if (totalTimeoutId) clearTimeout(totalTimeoutId)
      throw new AllTiersFailedError(history)
    } catch (error) {
      if (totalTimeoutId) clearTimeout(totalTimeoutId)

      const endTime = Date.now()
      this.emitEvent({
        who: this.actor,
        what: 'cascade-failed',
        when: endTime,
        where: this.cascadeName,
        why: error instanceof Error ? error.message : String(error),
        how: {
          status: 'failed',
          duration: endTime - startTime,
        },
      })

      throw error
    }
  }

  /**
   * Execute a single tier with timeout and retry support
   */
  private async executeTier(
    tier: CapabilityTier,
    handler: TierHandler<T>,
    input: unknown,
    cascadeContext: CascadeContext,
    cascadeStartTime: number,
    totalTimeoutPromise: Promise<never>
  ): Promise<TierResult> {
    const tierStartTime = Date.now()

    // Record step start
    const step = recordStep(cascadeContext, tier, {
      actor: this.actor,
      action: `execute-${tier}`,
    })

    // Emit tier start event
    this.emitEvent({
      who: this.actor,
      what: `tier-${tier}-execute`,
      when: tierStartTime,
      where: this.cascadeName,
      how: {
        status: 'running',
        metadata: { tier },
      },
    })

    // Determine timeout
    const timeout = this.getTierTimeout(tier)

    // Create tier context
    const tierContext: TierContext = {
      correlationId: cascadeContext.correlationId,
      tier,
      input,
      cascadeContext,
    }

    // Get retry config
    const retryConfig = this.config.retryConfig?.[tier]
    const maxRetries = retryConfig?.maxRetries ?? 0

    let lastError: Error | undefined
    let attempts = 0

    while (attempts <= maxRetries) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          () => handler.execute(input, tierContext),
          timeout,
          totalTimeoutPromise
        )

        const duration = Date.now() - tierStartTime

        // Mark step complete
        step.complete()

        // Emit tier success event
        this.emitEvent({
          who: this.actor,
          what: `tier-${tier}-execute`,
          when: Date.now(),
          where: this.cascadeName,
          how: {
            status: 'completed',
            duration,
            metadata: { tier, result },
          },
        })

        return {
          tier,
          success: true,
          value: result,
          duration,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        attempts++

        // Check if it's a timeout error
        const isTimeout =
          lastError.message.includes('timed out') || lastError.name === 'TimeoutError'

        // If we've exhausted retries or it's a total timeout, stop
        if (attempts > maxRetries || lastError instanceof CascadeTimeoutError) {
          const duration = Date.now() - tierStartTime

          // Mark step failed
          step.fail(lastError)

          // Emit tier failure event
          this.emitEvent({
            who: this.actor,
            what: `tier-${tier}-execute`,
            when: Date.now(),
            where: this.cascadeName,
            why: lastError.message,
            how: {
              status: 'failed',
              duration,
              metadata: { tier, error: lastError.message },
            },
          })

          // Emit escalation event if not last tier
          const nextTier = this.getNextConfiguredTier(tier)
          if (nextTier) {
            this.emitEvent({
              who: this.actor,
              what: `escalate-to-${nextTier}`,
              when: Date.now(),
              where: this.cascadeName,
              why: lastError.message,
              how: {
                status: 'running',
                metadata: { fromTier: tier, toTier: nextTier },
              },
            })
          }

          return {
            tier,
            success: false,
            error: lastError,
            timedOut: isTimeout,
            duration,
          }
        }

        // Wait before retry with exponential backoff
        if (retryConfig) {
          const delay = retryConfig.baseDelay * Math.pow(retryConfig.multiplier ?? 2, attempts - 1)
          await this.sleep(delay)
        }
      }
    }

    // Should not reach here, but handle edge case
    const duration = Date.now() - tierStartTime
    return {
      tier,
      success: false,
      ...(lastError !== undefined && { error: lastError }),
      duration,
    }
  }

  /**
   * Execute a function with a timeout
   */
  private async executeWithTimeout<R>(
    fn: () => Promise<R>,
    timeout: number | undefined,
    totalTimeoutPromise: Promise<never>
  ): Promise<R> {
    const promises: Promise<R>[] = [fn()]

    // Add total timeout race
    if (this.config.totalTimeout) {
      promises.push(totalTimeoutPromise)
    }

    // Add tier timeout
    if (timeout) {
      promises.push(
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            const error = new Error(`Tier timed out after ${timeout}ms`)
            error.name = 'TimeoutError'
            reject(error)
          }, timeout)
        })
      )
    }

    return Promise.race(promises)
  }

  /**
   * Get timeout for a tier
   */
  private getTierTimeout(tier: CapabilityTier): number | undefined {
    if (this.config.timeouts?.[tier]) {
      return this.config.timeouts[tier]
    }
    if (this.config.useDefaultTimeouts) {
      return DEFAULT_TIER_TIMEOUTS[tier]
    }
    return undefined
  }

  /**
   * Get the next configured tier after the given tier
   */
  private getNextConfiguredTier(currentTier: CapabilityTier): CapabilityTier | undefined {
    const currentIndex = TIER_ORDER.indexOf(currentTier)
    for (let i = currentIndex + 1; i < TIER_ORDER.length; i++) {
      const tier = TIER_ORDER[i]
      if (tier && this.config.tiers[tier]) {
        return tier
      }
    }
    return undefined
  }

  /**
   * Emit a 5W+H event
   */
  private emitEvent(event: FiveWHEvent): void {
    if (this.config.onEvent) {
      this.config.onEvent(event)
    }
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
