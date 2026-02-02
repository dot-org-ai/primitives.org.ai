/**
 * DurableCascadeExecutor - Durable tiered execution with cascade pattern for Workers
 *
 * Combines the cascade pattern (code -> generative -> agentic -> human)
 * with Cloudflare Workflows durability guarantees for use in worker contexts.
 *
 * ## Features
 *
 * - **Durable Execution**: Steps are persisted and can resume after failures
 * - **AI Gateway Integration**: Helpers for Cloudflare AI Gateway configuration
 * - **Automatic Checkpointing**: Each tier creates a durable checkpoint
 * - **Tier Escalation**: Automatic escalation on failure
 * - **5W+H Audit Events**: Full audit trail support
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { DurableCascadeExecutor, createAIGatewayConfig } from 'ai-props/worker'
 *
 * const cascade = new DurableCascadeExecutor('generate-content', {
 *   code: async (input) => {
 *     if (input.template) return { content: input.template }
 *     throw new Error('No template')
 *   },
 *   generative: async (input, ctx) => {
 *     const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
 *       messages: [{ role: 'user', content: 'Generate content' }]
 *     })
 *     return { content: result.response }
 *   }
 * })
 *
 * // In workflow
 * const result = await cascade.run(step, { topic: 'AI' })
 * ```
 *
 * @packageDocumentation
 */

import {
  CascadeExecutor,
  type CascadeConfig,
  type CascadeResult,
  type CascadeContext,
  type TierContext,
  type TierHandler,
  type CapabilityTier,
  type FiveWHEvent,
  type TierResult,
  TIER_ORDER,
  DEFAULT_TIER_TIMEOUTS,
  createCascadeContext,
  recordStep,
  AllTiersFailedError,
  CascadeTimeoutError,
} from './cascade.js'

// Re-export base types
export {
  CascadeExecutor,
  type CascadeConfig,
  type CascadeResult,
  type CascadeContext,
  type TierContext,
  type TierHandler,
  type CapabilityTier,
  type FiveWHEvent,
  type TierResult,
  TIER_ORDER,
  DEFAULT_TIER_TIMEOUTS,
  createCascadeContext,
  recordStep,
  AllTiersFailedError,
  CascadeTimeoutError,
}

// ============================================================================
// Worker-specific Types
// ============================================================================

/**
 * Configuration for retry behavior (Cloudflare Workflows format)
 */
export interface DurableRetryConfig {
  /** Maximum number of retry attempts */
  limit: number
  /** Delay between retries (string like '1 second' or number in ms) */
  delay?: string | number
  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential'
}

/**
 * Configuration for a durable step
 */
export interface DurableStepConfig {
  /** Retry configuration */
  retries?: DurableRetryConfig
  /** Timeout for the step (string like '30 seconds' or number in ms) */
  timeout?: string | number
}

/**
 * Interface for Cloudflare Workflows step object
 */
export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>
  do<T>(name: string, config: DurableStepConfig, callback: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string | number): Promise<void>
  sleepUntil(name: string, timestamp: Date | number): Promise<void>
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
 * Human review request
 */
export interface HumanReviewRequest {
  type: string
  data: unknown
  assignee?: string
}

/**
 * Context provided to durable cascade tier handlers
 */
export interface DurableCascadeTierContext<TInput = unknown> extends TierContext<TInput> {
  /** AI binding for generative/agentic tiers */
  ai: AiBinding
  /** Request human review */
  requestHumanReview: (request: HumanReviewRequest) => Promise<{ reviewId: string; status: string }>
  /** Workflow step for nested durable operations */
  workflowStep: WorkflowStep
}

/**
 * Code tier handler (deterministic, fast)
 */
export type CodeTierHandler<TInput, TOutput> = (input: TInput) => Promise<TOutput>

/**
 * AI tier handler (generative or agentic)
 */
export type AiTierHandler<TInput, TOutput> = (
  input: TInput,
  ctx: DurableCascadeTierContext<TInput>
) => Promise<TOutput>

/**
 * Human tier handler
 */
export type HumanTierHandler<TInput, TOutput> = (
  input: TInput,
  ctx: DurableCascadeTierContext<TInput>
) => Promise<TOutput>

/**
 * Configuration for DurableCascadeExecutor
 */
export interface DurableCascadeConfig<TInput = unknown, TOutput = unknown> {
  /** Code tier handler (deterministic, fast) */
  code?: CodeTierHandler<TInput, TOutput>
  /** Generative AI tier handler */
  generative?: AiTierHandler<TInput, TOutput>
  /** Agentic AI tier handler (multi-step reasoning) */
  agentic?: AiTierHandler<TInput, TOutput>
  /** Human tier handler (human-in-the-loop) */
  human?: HumanTierHandler<TInput, TOutput>
  /** Per-tier timeout configuration (in ms) */
  timeouts?: Partial<Record<CapabilityTier, number>>
  /** Total cascade timeout (in ms) */
  totalTimeout?: number
  /** Per-tier retry configuration */
  tierConfig?: Partial<
    Record<
      CapabilityTier,
      {
        retries?: { limit: number; delay?: number; backoff?: 'constant' | 'linear' | 'exponential' }
        successCondition?: (result: unknown) => boolean
        onError?: (error: Error, tier: CapabilityTier) => void
      }
    >
  >
  /** Event callback for 5W+H audit events */
  onEvent?: (event: FiveWHEvent) => void
  /** Actor identifier for audit trail */
  actor?: string
}

// ============================================================================
// AI Gateway Configuration
// ============================================================================

/**
 * AI Gateway configuration for Cloudflare Workers
 */
export interface AIGatewayConfig {
  /** Gateway ID */
  gatewayId: string
  /** Account ID */
  accountId: string
  /** Cache TTL in seconds (0 to disable) */
  cacheTtl?: number
  /** Skip cache for this request */
  skipCache?: boolean
  /** Custom metadata to attach to requests */
  metadata?: Record<string, string>
}

/**
 * Create AI Gateway configuration for use with cascades
 *
 * @example
 * ```typescript
 * const gatewayConfig = createAIGatewayConfig({
 *   gatewayId: 'my-gateway',
 *   accountId: env.CF_ACCOUNT_ID,
 *   cacheTtl: 3600, // 1 hour
 * })
 *
 * // Use with AI binding
 * const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
 *   messages: [...],
 *   ...gatewayConfig.toRequestOptions()
 * })
 * ```
 */
export function createAIGatewayConfig(config: AIGatewayConfig): {
  config: AIGatewayConfig
  toRequestOptions: () => Record<string, unknown>
  getCacheKey: (input: unknown) => string
} {
  return {
    config,
    toRequestOptions: () => ({
      gateway: {
        id: config.gatewayId,
        skipCache: config.skipCache ?? false,
        cacheTtl: config.cacheTtl ?? 0,
        metadata: config.metadata,
      },
    }),
    getCacheKey: (input: unknown) => {
      const inputStr = JSON.stringify(input)
      return `${config.gatewayId}:${inputStr.slice(0, 100)}`
    },
  }
}

// ============================================================================
// DurableCascadeExecutor
// ============================================================================

/**
 * DurableCascadeExecutor - Durable tiered execution with cascade pattern
 *
 * Combines the cascade pattern (code -> generative -> agentic -> human)
 * with Cloudflare Workflows durability guarantees. Each tier execution
 * creates a durable checkpoint that survives process restarts.
 */
export class DurableCascadeExecutor<TInput = unknown, TOutput = unknown> {
  /** Cascade name */
  readonly name: string

  /** Cascade configuration */
  readonly config: DurableCascadeConfig<TInput, TOutput>

  /** AI binding (injected at runtime) */
  private ai?: AiBinding

  /** Human review handler */
  private humanReviewHandler?: (
    request: HumanReviewRequest
  ) => Promise<{ reviewId: string; status: string }>

  constructor(name: string, config: DurableCascadeConfig<TInput, TOutput>) {
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
    const cascadeContext = createCascadeContext({ name: this.name })

    const startTime = Date.now()
    const history: TierResult<TOutput>[] = []
    const skippedTiers: CapabilityTier[] = []
    const tierDurations: Record<string, number> = {}
    const previousErrors: Array<{ tier: CapabilityTier; error: string }> = []

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
    for (const tier of TIER_ORDER) {
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
          throw new CascadeTimeoutError(this.config.totalTimeout, elapsed)
        }
      }

      // Create tier context
      const tierContext: DurableCascadeTierContext<TInput> = {
        correlationId: cascadeContext.correlationId,
        tier,
        input,
        cascadeContext,
        previousErrors: [...previousErrors],
        ai: ai ?? this.createMockAi(),
        requestHumanReview: async (request) => {
          if (humanReviewHandler) {
            return humanReviewHandler(request)
          }
          const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
          return { reviewId, status: 'pending-human' }
        },
        workflowStep,
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
          value: tierResult.value,
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

    throw new AllTiersFailedError(history)
  }

  /**
   * Execute a single tier with durability
   */
  private async executeTier(
    workflowStep: WorkflowStep,
    tier: CapabilityTier,
    handler: CodeTierHandler<TInput, TOutput> | AiTierHandler<TInput, TOutput>,
    input: TInput,
    tierContext: DurableCascadeTierContext<TInput>,
    cascadeContext: CascadeContext
  ): Promise<TierResult<TOutput>> {
    const tierStartTime = Date.now()
    const tierConfig = this.config.tierConfig?.[tier]
    const timeout = this.config.timeouts?.[tier] ?? DEFAULT_TIER_TIMEOUTS[tier]
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
        // Execute with timeout using workflow step (durable)
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

        // Wait before retry with backoff (using durable sleep)
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
    tier: CapabilityTier
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
  private getNextConfiguredTier(currentTier: CapabilityTier): CapabilityTier | undefined {
    const currentIndex = TIER_ORDER.indexOf(currentTier)
    for (let i = currentIndex + 1; i < TIER_ORDER.length; i++) {
      const tier = TIER_ORDER[i]
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a durable cascade step for common AI props patterns
 *
 * @example
 * ```typescript
 * const titleCascade = createDurableCascadeStep({
 *   name: 'generate-title',
 *   code: async (input) => {
 *     if (input.template) return { title: input.template }
 *     throw new Error('No template')
 *   },
 *   generative: async (input, ctx) => {
 *     const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
 *       messages: [{ role: 'user', content: `Generate a title for: ${input.topic}` }]
 *     })
 *     return { title: result.response }
 *   }
 * })
 *
 * // In workflow
 * const result = await titleCascade.run(step, { topic: 'AI' })
 * ```
 */
export function createDurableCascadeStep<TInput = unknown, TOutput = unknown>(config: {
  name: string
  code?: CodeTierHandler<TInput, TOutput>
  generative?: AiTierHandler<TInput, TOutput>
  agentic?: AiTierHandler<TInput, TOutput>
  human?: HumanTierHandler<TInput, TOutput>
  timeouts?: Partial<Record<CapabilityTier, number>>
  tierConfig?: DurableCascadeConfig<TInput, TOutput>['tierConfig']
  onEvent?: (event: FiveWHEvent) => void
  actor?: string
}): DurableCascadeExecutor<TInput, TOutput> {
  const durableConfig: DurableCascadeConfig<TInput, TOutput> = {}

  if (config.code) {
    durableConfig.code = config.code
  }
  if (config.generative) {
    durableConfig.generative = config.generative
  }
  if (config.agentic) {
    durableConfig.agentic = config.agentic
  }
  if (config.human) {
    durableConfig.human = config.human
  }
  if (config.timeouts) {
    durableConfig.timeouts = config.timeouts
  }
  if (config.tierConfig) {
    durableConfig.tierConfig = config.tierConfig
  }
  if (config.onEvent) {
    durableConfig.onEvent = config.onEvent
  }
  if (config.actor) {
    durableConfig.actor = config.actor
  }

  return new DurableCascadeExecutor(config.name, durableConfig)
}
