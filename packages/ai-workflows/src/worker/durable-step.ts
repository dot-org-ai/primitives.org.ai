/**
 * DurableStep - Wrapper for Cloudflare Workflows step semantics
 *
 * Provides durable execution, retries, sleep, and step metadata
 * by wrapping Cloudflare Workflows' step.do() primitive. This is the
 * foundation for building reliable, resumable workflow steps.
 *
 * ## Features
 *
 * - **Durable Execution**: Steps are persisted and can resume after failures
 * - **Automatic Retries**: Configure retry behavior with backoff strategies
 * - **Timeout Support**: Set per-step timeouts for long-running operations
 * - **Step Context**: Access to nested durable operations and sleep
 * - **Type Safety**: Full TypeScript generics for input/output types
 * - **Cascade Pattern**: Tiered execution with code -> generative -> agentic -> human escalation
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { DurableStep } from 'ai-workflows/worker'
 *
 * // Simple step with type inference
 * const fetchData = new DurableStep('fetch-data', async (input: { url: string }) => {
 *   const response = await fetch(input.url)
 *   return response.json()
 * })
 *
 * // With retry configuration
 * const processPayment = new DurableStep(
 *   'process-payment',
 *   { retries: { limit: 3, delay: '1 second', backoff: 'exponential' } },
 *   async (input: { amount: number }) => {
 *     return { success: true }
 *   }
 * )
 *
 * // Run with workflow step
 * const result = await fetchData.run(step, { url: 'https://api.example.com' })
 * ```
 *
 * ## Using StepContext
 *
 * @example
 * ```typescript
 * const complexStep = new DurableStep('complex', async (input, ctx) => {
 *   // Access step metadata
 *   console.log(`Attempt ${ctx.metadata.attempt} of step ${ctx.metadata.id}`)
 *
 *   // Nested durable operation
 *   const result = await ctx.do('fetch-api', async () => {
 *     return fetch('https://api.example.com').then(r => r.json())
 *   })
 *
 *   return result
 * })
 * ```
 *
 * ## Cascade Pattern
 *
 * @example
 * ```typescript
 * const processRefund = DurableStep.cascade('process-refund', {
 *   code: async (input) => {
 *     if (input.amount < 100) return { approved: true }
 *     throw new Error('Needs AI review')
 *   },
 *   generative: async (input, ctx) => {
 *     const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
 *       messages: [{ role: 'user', content: 'Approve refund?' }]
 *     })
 *     return { approved: result.response.includes('yes') }
 *   },
 *   human: async (input, ctx) => {
 *     return ctx.requestHumanReview({ type: 'refund', data: input })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import {
  createCascadeContext,
  recordStep,
  type CascadeContext as BaseCascadeContext,
  type FiveWHEvent,
} from '../cascade-context.js'

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  limit: number
  /** Delay between retries (string like '1 second' or number in ms) */
  delay?: string | number
  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential'
}

/**
 * Configuration for a step, matching Cloudflare WorkflowStepConfig
 */
export interface StepConfig {
  /** Retry configuration */
  retries?: RetryConfig
  /** Timeout for the step (string like '30 seconds' or number in ms) */
  timeout?: string | number
}

/**
 * Metadata about the current step execution
 */
export interface StepMetadata {
  /** Step identifier */
  id: string
  /** Current attempt number (1-based) */
  attempt: number
  /** Configured retry limit (0 if no retries configured) */
  retries: number
}

/**
 * Interface for Cloudflare Workflows step object
 */
export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>
  do<T>(name: string, config: StepConfig, callback: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string | number): Promise<void>
  sleepUntil(name: string, timestamp: Date | number): Promise<void>
}

/**
 * Context provided to step functions for additional operations
 */
export class StepContext {
  private workflowStep: WorkflowStep
  private stepName: string
  private stepConfig: StepConfig | undefined
  private currentAttempt: number

  /**
   * Create a new StepContext
   *
   * @param workflowStep - The underlying Cloudflare workflow step
   * @param stepName - The name of the parent step
   * @param stepConfig - Optional step configuration
   * @param attempt - Current attempt number
   */
  constructor(
    workflowStep: WorkflowStep,
    stepName: string,
    stepConfig?: StepConfig,
    attempt: number = 1
  ) {
    this.workflowStep = workflowStep
    this.stepName = stepName
    this.stepConfig = stepConfig
    this.currentAttempt = attempt
  }

  /**
   * Metadata about the current step execution
   */
  get metadata(): StepMetadata {
    return {
      id: this.stepName,
      attempt: this.currentAttempt,
      retries: this.stepConfig?.retries?.limit ?? 0,
    }
  }

  /**
   * Execute a named side effect durably
   *
   * @param name - Unique name for this side effect
   * @param callback - Function to execute
   * @returns Result of the callback
   */
  do<T>(name: string, callback: () => Promise<T>): Promise<T>

  /**
   * Execute a named side effect durably with configuration
   *
   * @param name - Unique name for this side effect
   * @param config - Step configuration (retries, timeout)
   * @param callback - Function to execute
   * @returns Result of the callback
   */
  do<T>(name: string, config: StepConfig, callback: () => Promise<T>): Promise<T>

  /**
   * Implementation of do() overloads
   */
  do<T>(
    name: string,
    configOrCallback: StepConfig | (() => Promise<T>),
    maybeCallback?: () => Promise<T>
  ): Promise<T> {
    if (typeof configOrCallback === 'function') {
      return this.workflowStep.do(name, configOrCallback)
    } else {
      return this.workflowStep.do(name, configOrCallback, maybeCallback!)
    }
  }

  /**
   * Sleep for a specified duration
   *
   * @param name - Unique name for this sleep operation
   * @param duration - Duration to sleep (string like '5 seconds' or number in ms)
   */
  sleep(name: string, duration: string | number): Promise<void> {
    return this.workflowStep.sleep(name, duration)
  }

  /**
   * Sleep until a specified timestamp
   *
   * @param name - Unique name for this sleep operation
   * @param timestamp - Date or unix timestamp to sleep until
   */
  sleepUntil(name: string, timestamp: Date | number): Promise<void> {
    return this.workflowStep.sleepUntil(name, timestamp)
  }
}

/**
 * Type for the step function
 */
export type StepFunction<TInput, TOutput> = (input: TInput, ctx: StepContext) => Promise<TOutput>

/**
 * DurableStep - Wrapper for durable function execution
 *
 * Wraps a function for durable execution using Cloudflare Workflows'
 * step.do() primitive. Provides retry configuration, timeout, and
 * access to step context.
 *
 * @typeParam TInput - Input type for the step function
 * @typeParam TOutput - Output type for the step function
 */
export class DurableStep<TInput = void, TOutput = void> {
  /** Step name */
  readonly name: string

  /** Step configuration (retries, timeout) */
  readonly config?: StepConfig

  /** The wrapped function */
  readonly fn: (input: TInput, ctx: StepContext) => Promise<TOutput>

  /**
   * Create a DurableStep with just a name and function
   *
   * @param name - Unique name for this step
   * @param fn - Function to execute
   */
  constructor(name: string, fn: (input: TInput, ctx?: StepContext) => Promise<TOutput>)

  /**
   * Create a DurableStep with name, config, and function
   *
   * @param name - Unique name for this step
   * @param config - Step configuration (retries, timeout)
   * @param fn - Function to execute
   */
  constructor(
    name: string,
    config: StepConfig,
    fn: (input: TInput, ctx?: StepContext) => Promise<TOutput>
  )

  /**
   * Implementation of constructor overloads
   */
  constructor(
    name: string,
    configOrFn: StepConfig | ((input: TInput, ctx?: StepContext) => Promise<TOutput>),
    maybeFn?: (input: TInput, ctx?: StepContext) => Promise<TOutput>
  ) {
    this.name = name

    if (typeof configOrFn === 'function') {
      this.fn = configOrFn as (input: TInput, ctx: StepContext) => Promise<TOutput>
    } else {
      this.config = configOrFn
      this.fn = maybeFn as (input: TInput, ctx: StepContext) => Promise<TOutput>
    }
  }

  /**
   * Run the step with durable execution
   *
   * @param workflowStep - The Cloudflare workflow step object
   * @param input - Input for the step function
   * @returns Result of the step function
   */
  async run(workflowStep: WorkflowStep, input: TInput): Promise<TOutput> {
    const ctx = new StepContext(workflowStep, this.name, this.config)

    if (this.config) {
      return workflowStep.do(this.name, this.config, async () => {
        return this.fn(input, ctx)
      })
    } else {
      return workflowStep.do(this.name, async () => {
        return this.fn(input, ctx)
      })
    }
  }

  /**
   * Create a durable cascade step with tiered execution
   *
   * The cascade pattern executes tiers in order: code -> generative -> agentic -> human
   * Each tier can short-circuit on success, or escalate to the next tier on failure.
   *
   * @param name - Unique name for this cascade step
   * @param config - Cascade configuration with tier handlers
   * @returns DurableCascadeStep instance
   *
   * @example
   * ```typescript
   * const processRefund = DurableStep.cascade('process-refund', {
   *   code: async (input) => {
   *     if (input.amount < 100) return { approved: true }
   *     throw new Error('Needs AI review')
   *   },
   *   generative: async (input, ctx) => {
   *     const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
   *       messages: [{ role: 'user', content: 'Approve refund?' }]
   *     })
   *     return { approved: result.response.includes('yes') }
   *   },
   *   human: async (input, ctx) => {
   *     return ctx.requestHumanReview({ type: 'refund', data: input })
   *   }
   * })
   * ```
   */
  static cascade<TInput = unknown, TOutput = unknown>(
    name: string,
    config: CascadeConfig<TInput, TOutput>
  ): DurableCascadeStep<TInput, TOutput> {
    return new DurableCascadeStep(name, config)
  }
}

// ============================================================================
// Cascade Types
// ============================================================================

/**
 * Tier names in cascade order
 */
export type CascadeTier = 'code' | 'generative' | 'agentic' | 'human'

/**
 * Default timeouts per tier in milliseconds
 */
export const DEFAULT_CASCADE_TIMEOUTS: Record<CascadeTier, number> = {
  code: 5000, // 5 seconds
  generative: 30000, // 30 seconds
  agentic: 300000, // 5 minutes
  human: 86400000, // 24 hours
}

/**
 * Ordered list of cascade tiers
 */
export const CASCADE_TIER_ORDER: CascadeTier[] = ['code', 'generative', 'agentic', 'human']

/**
 * Human review request
 */
export interface HumanReviewRequest {
  type: string
  data: unknown
  assignee?: string
}

/**
 * AI binding interface (matches Cloudflare AI binding)
 */
export interface AiBinding {
  run<T = unknown>(
    model: string,
    options: { messages: Array<{ role: string; content: string }> }
  ): Promise<T & { response?: string }>
}

/**
 * Context provided to cascade tier handlers
 */
export interface CascadeTierContext<TInput = unknown> {
  /** AI binding for generative/agentic tiers */
  ai: AiBinding
  /** Previous tier errors (for context) */
  previousErrors: Array<{ tier: CascadeTier; error: string; attempt: number }>
  /** Request human review */
  requestHumanReview: (request: HumanReviewRequest) => Promise<{ reviewId: string; status: string }>
  /** Cascade context for tracing */
  cascadeContext: CascadeContext
  /** Input data */
  input: TInput
  /** Current tier */
  tier: CascadeTier
}

/**
 * Configuration for a specific tier
 */
export interface CascadeTierConfig {
  /** Timeout in milliseconds */
  timeout?: number
  /** Retry configuration */
  retries?: {
    limit: number
    delay?: number
    backoff?: 'constant' | 'linear' | 'exponential'
  }
  /** Custom success condition */
  successCondition?: (result: unknown) => boolean
  /** Custom error handler */
  onError?: (error: Error, tier: CascadeTier) => void
}

/**
 * Result from a single tier execution
 */
export interface CascadeTierResult<T = unknown> {
  /** Tier that was executed */
  tier: CascadeTier
  /** Whether the tier succeeded */
  success: boolean
  /** Result value (if success) */
  value?: T
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
 * Cascade execution context with tracing
 * Note: This interface extends BaseCascadeContext with no changes.
 * The 'steps' property is inherited from BaseCascadeContext.
 */
export interface CascadeContext extends BaseCascadeContext {
  // Inherits all properties from BaseCascadeContext including correlationId and steps
}

/**
 * Result from cascade execution
 */
export interface CascadeResult<T = unknown> {
  /** Final result value */
  value: T
  /** Tier that produced the result */
  tier: CascadeTier
  /** History of all tier executions */
  history: CascadeTierResult<T>[]
  /** Tiers that were skipped */
  skippedTiers: CascadeTier[]
  /** Cascade context with tracing info */
  context: CascadeContext
  /** Execution metrics */
  metrics: {
    totalDuration: number
    tierDurations: Record<string, number>
  }
}

/**
 * Handler for code tier (synchronous/deterministic)
 */
export type CodeTierHandler<TInput, TOutput> = (input: TInput) => Promise<TOutput>

/**
 * Handler for AI tiers (generative, agentic)
 */
export type AiTierHandler<TInput, TOutput> = (
  input: TInput,
  ctx: CascadeTierContext<TInput>
) => Promise<TOutput>

/**
 * Handler for human tier
 */
export type HumanTierHandler<TInput, TOutput> = (
  input: TInput,
  ctx: CascadeTierContext<TInput>
) => Promise<TOutput>

/**
 * Configuration for DurableStep.cascade()
 */
export interface CascadeConfig<TInput = unknown, TOutput = unknown> {
  /** Code tier handler (deterministic, fast) */
  code?: CodeTierHandler<TInput, TOutput>
  /** Generative AI tier handler */
  generative?: AiTierHandler<TInput, TOutput>
  /** Agentic AI tier handler (multi-step reasoning) */
  agentic?: AiTierHandler<TInput, TOutput>
  /** Human tier handler (human-in-the-loop) */
  human?: HumanTierHandler<TInput, TOutput>
  /** Per-tier timeout configuration */
  timeouts?: Partial<Record<CascadeTier, number>>
  /** Total cascade timeout */
  totalTimeout?: number
  /** Per-tier configuration */
  tierConfig?: Partial<Record<CascadeTier, CascadeTierConfig>>
  /** Event callback for 5W+H audit events */
  onEvent?: (event: FiveWHEvent) => void
  /** Custom result merger */
  resultMerger?: (results: CascadeTierResult<TOutput>[]) => TOutput
  /** Actor identifier for audit trail */
  actor?: string
}

/**
 * Error thrown when all cascade tiers fail
 */
export class AllTiersFailed extends Error {
  public readonly history: CascadeTierResult[]

  constructor(history: CascadeTierResult[]) {
    super('All cascade tiers failed')
    this.name = 'AllTiersFailed'
    this.history = history
  }
}

/**
 * Error thrown when cascade times out
 */
export class CascadeTimeout extends Error {
  public readonly timeout: number
  public readonly elapsed: number

  constructor(timeout: number, elapsed: number) {
    super(`Cascade timed out after ${elapsed}ms (limit: ${timeout}ms)`)
    this.name = 'CascadeTimeout'
    this.timeout = timeout
    this.elapsed = elapsed
  }
}

// ============================================================================
// DurableCascadeStep
// ============================================================================

/**
 * DurableCascadeStep - Durable tiered execution with cascade pattern
 *
 * Combines the cascade pattern (code -> generative -> agentic -> human)
 * with Cloudflare Workflows durability guarantees.
 */
export class DurableCascadeStep<TInput = unknown, TOutput = unknown> {
  /** Cascade name */
  readonly name: string

  /** Cascade configuration */
  readonly config: CascadeConfig<TInput, TOutput>

  /** AI binding (injected at runtime) */
  private ai?: AiBinding

  /** Human review handler */
  private humanReviewHandler?: (
    request: HumanReviewRequest
  ) => Promise<{ reviewId: string; status: string }>

  constructor(name: string, config: CascadeConfig<TInput, TOutput>) {
    this.name = name
    this.config = config
  }

  /**
   * Set the AI binding for generative/agentic tiers
   */
  setAi(ai: AiBinding): this {
    this.ai = ai
    return this
  }

  /**
   * Set the human review handler
   */
  setHumanReviewHandler(
    handler: (request: HumanReviewRequest) => Promise<{ reviewId: string; status: string }>
  ): this {
    this.humanReviewHandler = handler
    return this
  }

  /**
   * Run the cascade with durable execution
   */
  async run(
    workflowStep: WorkflowStep,
    input: TInput,
    options?: {
      ai?: AiBinding
      humanReviewHandler?: (
        request: HumanReviewRequest
      ) => Promise<{ reviewId: string; status: string }>
    }
  ): Promise<CascadeResult<TOutput>> {
    const ai = options?.ai ?? this.ai
    const humanReviewHandler = options?.humanReviewHandler ?? this.humanReviewHandler

    // Create cascade context for tracing
    const cascadeContext = createCascadeContext({ name: this.name }) as CascadeContext

    const startTime = Date.now()
    const history: CascadeTierResult<TOutput>[] = []
    const skippedTiers: CascadeTier[] = []
    const tierDurations: Record<string, number> = {}
    const previousErrors: Array<{ tier: CascadeTier; error: string; attempt: number }> = []
    let checkpointsCreated = 0
    const checkpointIds: string[] = []

    // Emit cascade start event
    this.emitEvent({
      who: this.config.actor ?? 'system',
      what: 'cascade-start',
      when: startTime,
      where: this.name,
      how: {
        status: 'running',
        metadata: { input },
      },
    })

    // Execute tiers in order
    for (const tier of CASCADE_TIER_ORDER) {
      const handler = this.getTierHandler(tier)

      // Skip unconfigured tiers
      if (!handler) {
        skippedTiers.push(tier)
        continue
      }

      // Check total timeout
      if (this.config.totalTimeout) {
        const elapsed = Date.now() - startTime
        if (elapsed >= this.config.totalTimeout) {
          throw new CascadeTimeout(this.config.totalTimeout, elapsed)
        }
      }

      // Create tier context
      const tierContext: CascadeTierContext<TInput> = {
        ai: ai ?? this.createMockAi(),
        previousErrors: [...previousErrors],
        requestHumanReview: async (request) => {
          if (humanReviewHandler) {
            return humanReviewHandler(request)
          }
          const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
          return { reviewId, status: 'pending-human' }
        },
        cascadeContext,
        input,
        tier,
      }

      // Execute tier with durability
      const tierResult = await this.executeTier(
        workflowStep,
        tier,
        handler,
        input,
        tierContext,
        cascadeContext
      )

      // Record checkpoint
      checkpointsCreated++
      checkpointIds.push(`${this.name}-${tier}-${Date.now()}`)

      history.push(tierResult)
      tierDurations[tier] = tierResult.duration

      // If tier succeeded, we're done
      if (tierResult.success && tierResult.value !== undefined) {
        // Check custom success condition
        const tierConfig = this.config.tierConfig?.[tier]
        if (tierConfig?.successCondition && !tierConfig.successCondition(tierResult.value)) {
          // Success condition not met, treat as failure and continue
          previousErrors.push({
            tier,
            error: 'Success condition not met',
            attempt: tierResult.attempts ?? 1,
          })
          continue
        }

        const endTime = Date.now()
        this.emitEvent({
          who: this.config.actor ?? 'system',
          what: 'cascade-complete',
          when: endTime,
          where: this.name,
          how: {
            status: 'completed',
            duration: endTime - startTime,
            metadata: { tier, value: tierResult.value },
          },
        })

        return {
          value: tierResult.value as TOutput,
          tier,
          history,
          skippedTiers,
          context: cascadeContext,
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
          attempt: tierResult.attempts ?? 1,
        })

        // Emit escalation event
        const nextTier = this.getNextConfiguredTier(tier)
        if (nextTier) {
          this.emitEvent({
            who: this.config.actor ?? 'system',
            what: `escalate-to-${nextTier}`,
            when: Date.now(),
            where: this.name,
            why: tierResult.error.message,
            how: {
              status: 'running',
              metadata: { fromTier: tier, toTier: nextTier },
            },
          })
        }
      }
    }

    // All tiers failed
    const endTime = Date.now()
    this.emitEvent({
      who: this.config.actor ?? 'system',
      what: 'cascade-failed',
      when: endTime,
      where: this.name,
      why: 'All tiers failed',
      how: {
        status: 'failed',
        duration: endTime - startTime,
      },
    })

    throw new AllTiersFailed(history)
  }

  /**
   * Execute a single tier with durability
   */
  private async executeTier(
    workflowStep: WorkflowStep,
    tier: CascadeTier,
    handler: CodeTierHandler<TInput, TOutput> | AiTierHandler<TInput, TOutput>,
    input: TInput,
    tierContext: CascadeTierContext<TInput>,
    cascadeContext: CascadeContext
  ): Promise<CascadeTierResult<TOutput>> {
    const tierStartTime = Date.now()
    const tierConfig = this.config.tierConfig?.[tier]
    const timeout = this.config.timeouts?.[tier] ?? DEFAULT_CASCADE_TIMEOUTS[tier]
    const maxRetries = tierConfig?.retries?.limit ?? 0

    // Record step in cascade context
    const step = recordStep(cascadeContext, tier, {
      actor: this.config.actor ?? 'system',
      action: `execute-${tier}`,
    })

    // Emit tier start event
    this.emitEvent({
      who: this.config.actor ?? 'system',
      what: `tier-${tier}-execute`,
      when: tierStartTime,
      where: this.name,
      how: {
        status: 'running',
        metadata: { tier },
      },
    })

    let lastError: Error | undefined
    let attempts = 0

    while (attempts <= maxRetries) {
      attempts++

      try {
        // Execute with timeout using workflow step
        const result = await workflowStep.do(
          `${this.name}-${tier}-attempt-${attempts}`,
          timeout !== undefined ? { timeout: `${timeout} milliseconds` } : {},
          async () => {
            if (tier === 'code') {
              return (handler as CodeTierHandler<TInput, TOutput>)(input)
            } else {
              return (handler as AiTierHandler<TInput, TOutput>)(input, tierContext)
            }
          }
        )

        const duration = Date.now() - tierStartTime

        // Mark step complete
        step.complete()

        // Emit tier success event
        this.emitEvent({
          who: this.config.actor ?? 'system',
          what: `tier-${tier}-execute`,
          when: Date.now(),
          where: this.name,
          how: {
            status: 'completed',
            duration,
            metadata: { tier, result, attempts },
          },
        })

        return {
          tier,
          success: true,
          value: result as TOutput,
          duration,
          attempts,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if it's a timeout error
        const isTimeout =
          lastError.message.includes('timed out') ||
          lastError.message.includes('timeout') ||
          lastError.name === 'TimeoutError'

        // Call custom error handler if provided
        if (tierConfig?.onError) {
          tierConfig.onError(lastError, tier)
        }

        // If we've exhausted retries, stop
        if (attempts > maxRetries) {
          break
        }

        // Wait before retry with backoff
        if (tierConfig?.retries?.delay) {
          const backoff = tierConfig.retries.backoff ?? 'constant'
          let delay = tierConfig.retries.delay

          if (backoff === 'exponential') {
            delay = tierConfig.retries.delay * Math.pow(2, attempts - 1)
          } else if (backoff === 'linear') {
            delay = tierConfig.retries.delay * attempts
          }

          await workflowStep.sleep(`${this.name}-${tier}-retry-wait-${attempts}`, delay)
        }
      }
    }

    const duration = Date.now() - tierStartTime
    const isTimeout =
      lastError?.message.includes('timed out') ||
      lastError?.message.includes('timeout') ||
      lastError?.name === 'TimeoutError'

    // Mark step failed
    if (lastError) {
      step.fail(lastError)
    }

    // Emit tier failure event
    this.emitEvent({
      who: this.config.actor ?? 'system',
      what: `tier-${tier}-execute`,
      when: Date.now(),
      where: this.name,
      ...(lastError?.message !== undefined && { why: lastError.message }),
      how: {
        status: 'failed',
        duration,
        metadata: { tier, error: lastError?.message, attempts },
      },
    })

    return {
      tier,
      success: false,
      ...(lastError !== undefined && { error: lastError }),
      timedOut: isTimeout,
      duration,
      attempts,
    }
  }

  /**
   * Get the handler for a tier
   */
  private getTierHandler(
    tier: CascadeTier
  ): CodeTierHandler<TInput, TOutput> | AiTierHandler<TInput, TOutput> | undefined {
    switch (tier) {
      case 'code':
        return this.config.code
      case 'generative':
        return this.config.generative
      case 'agentic':
        return this.config.agentic
      case 'human':
        return this.config.human
      default:
        return undefined
    }
  }

  /**
   * Get the next configured tier
   */
  private getNextConfiguredTier(currentTier: CascadeTier): CascadeTier | undefined {
    const currentIndex = CASCADE_TIER_ORDER.indexOf(currentTier)
    for (let i = currentIndex + 1; i < CASCADE_TIER_ORDER.length; i++) {
      const tier = CASCADE_TIER_ORDER[i]
      if (tier && this.getTierHandler(tier)) {
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
   * Create a mock AI binding for testing
   */
  private createMockAi(): AiBinding {
    return {
      run: async <T>(): Promise<T> => ({ response: 'mock response' } as unknown as T),
    }
  }
}
