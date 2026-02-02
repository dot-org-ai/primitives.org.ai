/**
 * Cascade Executor - Code -> Generative -> Agentic -> Human escalation pattern for AI Props
 *
 * Implements a tiered execution strategy that tries deterministic code first,
 * then escalates to AI-powered prop generation, and finally to human-in-the-loop
 * if all automated approaches fail.
 *
 * ## Features
 *
 * - **Tier Escalation**: Code -> Generative -> Agentic -> Human pattern
 * - **Per-tier Timeouts**: Configurable timeouts for each tier
 * - **5W+H Audit Events**: Who, What, When, Where, Why, How event emission
 * - **Context Propagation**: Share context across tiers
 * - **Retry Support**: Configurable retries per tier with backoff
 * - **AI Gateway Support**: Configuration helpers for Cloudflare AI Gateway
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { CascadeExecutor, createCascadeStep } from 'ai-props/worker'
 *
 * const generateTitleCascade = new CascadeExecutor({
 *   tiers: {
 *     code: {
 *       name: 'template-title',
 *       execute: async (input) => {
 *         if (input.template) return { title: input.template }
 *         throw new Error('No template')
 *       }
 *     },
 *     generative: {
 *       name: 'ai-title',
 *       execute: async (input) => {
 *         const result = await generateProps({
 *           schema: { title: 'A compelling title' },
 *           context: input
 *         })
 *         return result.props
 *       }
 *     }
 *   }
 * })
 *
 * const result = await generateTitleCascade.execute({ topic: 'AI' })
 * console.log(result.value) // { title: '...' }
 * console.log(result.tier) // 'code' or 'generative'
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Ordered list of capability tiers
 */
export const TIER_ORDER = ['code', 'generative', 'agentic', 'human'] as const

/**
 * Default timeouts per tier (in milliseconds)
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
 * 5W+H Event for audit trails
 */
export interface FiveWHEvent {
  /** Who performed the action */
  who: string
  /** What action was performed */
  what: string
  /** When the action occurred (timestamp) */
  when: number
  /** Where the action occurred (cascade/tier name) */
  where: string
  /** Why the action was performed (reason/error) */
  why?: string
  /** How the action was performed */
  how?: {
    status: 'running' | 'completed' | 'failed'
    duration?: number
    metadata?: Record<string, unknown>
  }
}

/**
 * Cascade step tracking
 */
export interface CascadeStep {
  id: string
  tier: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  error?: string
}

/**
 * Cascade context for tracing
 */
export interface CascadeContext {
  correlationId: string
  name: string
  steps: CascadeStep[]
}

/**
 * Context passed to tier handlers
 */
export interface TierContext<TInput = unknown> {
  /** Correlation ID for tracing */
  correlationId: string
  /** Current tier being executed */
  tier: CapabilityTier
  /** Input data */
  input: TInput
  /** Cascade context */
  cascadeContext: CascadeContext
  /** Previous tier errors */
  previousErrors: Array<{ tier: CapabilityTier; error: string }>
}

/**
 * Handler for a specific tier
 */
export interface TierHandler<TInput = unknown, TOutput = unknown> {
  /** Handler name for debugging */
  name: string
  /** Execute the tier logic */
  execute: (input: TInput, context: TierContext<TInput>) => Promise<TOutput>
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
export interface TierResult<TOutput = unknown> {
  /** Tier that was executed */
  tier: CapabilityTier
  /** Whether the tier succeeded */
  success: boolean
  /** Result value (if success) */
  value?: TOutput
  /** Error (if failure) */
  error?: Error
  /** Whether the tier timed out */
  timedOut?: boolean
  /** Duration in milliseconds */
  duration: number
  /** Number of attempts */
  attempts?: number
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
export interface CascadeResult<TOutput = unknown> {
  /** Final result value */
  value: TOutput
  /** Tier that produced the result */
  tier: CapabilityTier
  /** History of all tier executions */
  history: TierResult<TOutput>[]
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
export type SkipCondition<TInput = unknown> = (input: TInput) => boolean

/**
 * Configuration for CascadeExecutor
 */
export interface CascadeConfig<TInput = unknown, TOutput = unknown> {
  /** Tier handlers */
  tiers: Partial<Record<CapabilityTier, TierHandler<TInput, TOutput>>>
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
  skipConditions?: Partial<Record<CapabilityTier, SkipCondition<TInput>>>
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
// Helper Functions
// ============================================================================

/**
 * Create a cascade context for tracing
 */
export function createCascadeContext(options: { name: string }): CascadeContext {
  return {
    correlationId: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: options.name,
    steps: [],
  }
}

/**
 * Record a step in the cascade context
 */
export function recordStep(
  context: CascadeContext,
  tier: string,
  meta: { actor: string; action: string }
): {
  complete: () => void
  fail: (error: Error) => void
} {
  const step: CascadeStep = {
    id: `${tier}-${Date.now()}`,
    tier,
    status: 'running',
    startTime: Date.now(),
  }
  context.steps.push(step)

  return {
    complete: () => {
      step.status = 'completed'
      step.endTime = Date.now()
    },
    fail: (error: Error) => {
      step.status = 'failed'
      step.endTime = Date.now()
      step.error = error.message
    },
  }
}

// ============================================================================
// CascadeExecutor
// ============================================================================

/**
 * CascadeExecutor implements the code -> generative -> agentic -> human pattern
 *
 * This is the base executor for cascade patterns, suitable for both
 * synchronous and worker contexts.
 */
export class CascadeExecutor<TInput = unknown, TOutput = unknown> {
  protected readonly config: CascadeConfig<TInput, TOutput>
  protected readonly actor: string
  protected readonly cascadeName: string

  constructor(config: CascadeConfig<TInput, TOutput>) {
    this.config = config
    this.actor = config.actor || 'system'
    this.cascadeName = config.cascadeName || 'cascade'
  }

  /**
   * Execute the cascade
   */
  async execute(input: TInput): Promise<CascadeResult<TOutput>> {
    const startTime = Date.now()
    const context = createCascadeContext({ name: this.cascadeName })
    const history: TierResult<TOutput>[] = []
    const skippedTiers: CapabilityTier[] = []
    const tierDurations: Partial<Record<CapabilityTier, number>> = {}
    const previousErrors: Array<{ tier: CapabilityTier; error: string }> = []

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
          previousErrors,
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
            value: tierResult.value,
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

        // Record error for next tier
        if (tierResult.error) {
          previousErrors.push({
            tier,
            error: tierResult.error.message,
          })
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
  protected async executeTier(
    tier: CapabilityTier,
    handler: TierHandler<TInput, TOutput>,
    input: TInput,
    cascadeContext: CascadeContext,
    previousErrors: Array<{ tier: CapabilityTier; error: string }>,
    cascadeStartTime: number,
    totalTimeoutPromise: Promise<never>
  ): Promise<TierResult<TOutput>> {
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
    const tierContext: TierContext<TInput> = {
      correlationId: cascadeContext.correlationId,
      tier,
      input,
      cascadeContext,
      previousErrors: [...previousErrors],
    }

    // Get retry config
    const retryConfig = this.config.retryConfig?.[tier]
    const maxRetries = retryConfig?.maxRetries ?? 0

    let lastError: Error | undefined
    let attempts = 0

    while (attempts <= maxRetries) {
      attempts++
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
            metadata: { tier, result, attempts },
          },
        })

        return {
          tier,
          success: true,
          value: result,
          duration,
          attempts,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

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
              metadata: { tier, error: lastError.message, attempts },
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
            attempts,
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
      attempts,
    }
  }

  /**
   * Execute a function with a timeout
   */
  protected async executeWithTimeout<R>(
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
  protected getTierTimeout(tier: CapabilityTier): number | undefined {
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
  protected getNextConfiguredTier(currentTier: CapabilityTier): CapabilityTier | undefined {
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
  protected emitEvent(event: FiveWHEvent): void {
    if (this.config.onEvent) {
      this.config.onEvent(event)
    }
  }

  /**
   * Sleep for a given duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a cascade step configuration for common patterns
 *
 * @example
 * ```typescript
 * const titleCascade = createCascadeStep({
 *   name: 'generate-title',
 *   code: async (input) => {
 *     if (input.template) return { title: input.template }
 *     throw new Error('No template')
 *   },
 *   generative: async (input, ctx) => {
 *     const result = await generateProps({
 *       schema: { title: 'A compelling title' },
 *       context: input
 *     })
 *     return result.props
 *   }
 * })
 * ```
 */
export function createCascadeStep<TInput = unknown, TOutput = unknown>(config: {
  name: string
  code?: (input: TInput, ctx: TierContext<TInput>) => Promise<TOutput>
  generative?: (input: TInput, ctx: TierContext<TInput>) => Promise<TOutput>
  agentic?: (input: TInput, ctx: TierContext<TInput>) => Promise<TOutput>
  human?: (input: TInput, ctx: TierContext<TInput>) => Promise<TOutput>
  timeouts?: Partial<Record<CapabilityTier, number>>
  retryConfig?: Partial<Record<CapabilityTier, TierRetryConfig>>
  onEvent?: (event: FiveWHEvent) => void
}): CascadeExecutor<TInput, TOutput> {
  const tiers: Partial<Record<CapabilityTier, TierHandler<TInput, TOutput>>> = {}

  if (config.code) {
    tiers.code = { name: `${config.name}-code`, execute: config.code }
  }
  if (config.generative) {
    tiers.generative = { name: `${config.name}-generative`, execute: config.generative }
  }
  if (config.agentic) {
    tiers.agentic = { name: `${config.name}-agentic`, execute: config.agentic }
  }
  if (config.human) {
    tiers.human = { name: `${config.name}-human`, execute: config.human }
  }

  const cascadeConfig: CascadeConfig<TInput, TOutput> = {
    tiers,
    cascadeName: config.name,
    useDefaultTimeouts: true,
  }

  if (config.timeouts) {
    cascadeConfig.timeouts = config.timeouts
  }
  if (config.retryConfig) {
    cascadeConfig.retryConfig = config.retryConfig
  }
  if (config.onEvent) {
    cascadeConfig.onEvent = config.onEvent
  }

  return new CascadeExecutor(cascadeConfig)
}
