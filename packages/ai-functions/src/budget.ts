/**
 * Budget Tracking and Request Tracing for AI Functions
 *
 * Provides:
 * - Token counting and estimation
 * - Cost tracking by model
 * - Budget limits with alerts
 * - Request ID generation and tracing
 * - User/tenant context isolation
 *
 * @packageDocumentation
 */

import { randomUUID } from 'crypto'

// ============================================================================
// Types
// ============================================================================

/** Token usage for a single request */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model?: string
}

/** Model pricing per million tokens */
export interface ModelPricing {
  inputPricePerMillion: number
  outputPricePerMillion: number
}

/** Budget configuration */
export interface BudgetConfig {
  /** Maximum total tokens allowed */
  maxTokens?: number
  /** Maximum cost in USD */
  maxCost?: number
  /** Alert thresholds as fractions (e.g., [0.5, 0.8, 1.0]) */
  alertThresholds?: number[]
  /** Callback when threshold is reached */
  onAlert?: (alert: BudgetAlert) => void
  /** Custom pricing for models not in default pricing table */
  customPricing?: Record<string, ModelPricing>
  /** Maximum number of requests to keep in history */
  maxRequestHistory?: number
}

/** Budget alert payload */
export interface BudgetAlert {
  threshold: number
  currentUsage: number
  limit: number
  type: 'tokens' | 'cost'
}

/** Check budget options */
export interface CheckBudgetOptions {
  estimatedTokens?: number
  model?: string
}

/** Remaining budget info */
export interface RemainingBudget {
  tokens?: number
  cost?: number
}

/** Request info for tracking */
export interface RequestInfo {
  requestId: string
  model: string
  startTime: number
  endTime: number
  inputTokens: number
  outputTokens: number
  duration?: number
}

/** Stored request with computed duration */
interface StoredRequest extends RequestInfo {
  duration: number
}

/** Budget snapshot for export/import */
export interface BudgetSnapshot {
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  usageByModel: Record<string, { inputTokens: number; outputTokens: number; cost: number }>
  triggeredThresholds: number[]
}

/** Request context options */
export interface RequestContextOptions {
  requestId?: string
  userId?: string
  tenantId?: string
  parentRequestId?: string
  metadata?: Record<string, unknown>
}

/** Request context with tracing */
export interface IRequestContext {
  requestId: string
  userId?: string
  tenantId?: string
  parentRequestId?: string
  depth: number
  metadata?: Record<string, unknown>
  createChild(options?: Partial<RequestContextOptions>): IRequestContext
  toTraceHeaders(): Record<string, string>
  toTraceparent(): string
}

// ============================================================================
// Default Model Pricing (per million tokens, USD)
// ============================================================================

const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI models
  'gpt-4o': { inputPricePerMillion: 2.5, outputPricePerMillion: 10 },
  'gpt-4o-mini': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
  'gpt-4-turbo': { inputPricePerMillion: 10, outputPricePerMillion: 30 },
  'gpt-4': { inputPricePerMillion: 30, outputPricePerMillion: 60 },
  'gpt-3.5-turbo': { inputPricePerMillion: 0.5, outputPricePerMillion: 1.5 },
  'o1': { inputPricePerMillion: 15, outputPricePerMillion: 60 },
  'o1-mini': { inputPricePerMillion: 3, outputPricePerMillion: 12 },
  'o1-preview': { inputPricePerMillion: 15, outputPricePerMillion: 60 },
  'o3-mini': { inputPricePerMillion: 1.1, outputPricePerMillion: 4.4 },

  // Anthropic models
  'claude-opus-4-20250514': { inputPricePerMillion: 15, outputPricePerMillion: 75 },
  'claude-sonnet-4-20250514': { inputPricePerMillion: 3, outputPricePerMillion: 15 },
  'claude-3-5-sonnet-latest': { inputPricePerMillion: 3, outputPricePerMillion: 15 },
  'claude-3-5-haiku-latest': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
  'claude-3-opus-20240229': { inputPricePerMillion: 15, outputPricePerMillion: 75 },
  'claude-3-sonnet-20240229': { inputPricePerMillion: 3, outputPricePerMillion: 15 },
  'claude-3-haiku-20240307': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },

  // Google models
  'gemini-2.0-flash': { inputPricePerMillion: 0.1, outputPricePerMillion: 0.4 },
  'gemini-1.5-pro': { inputPricePerMillion: 1.25, outputPricePerMillion: 5 },
  'gemini-1.5-flash': { inputPricePerMillion: 0.075, outputPricePerMillion: 0.3 },

  // Default fallback
  'default': { inputPricePerMillion: 1, outputPricePerMillion: 3 },
}

// ============================================================================
// Token Counter
// ============================================================================

/** Message format for token counting */
interface Message {
  role: string
  content: string
}

/**
 * Token counter for estimating token usage
 *
 * Uses a simple character-based estimation that works across models.
 * For production, consider integrating tiktoken for more accurate counts.
 */
export class TokenCounter {
  /** Average characters per token (rough estimate) */
  private readonly charsPerToken = 4

  /** Overhead tokens per message for formatting */
  private readonly messageOverhead = 4

  /**
   * Estimate tokens for a text string
   */
  estimateTokens(text: string, _model?: string): number {
    if (!text) return 0

    // Count characters
    const charCount = text.length

    // Rough estimate: ~4 chars per token for English
    // Unicode characters may use more tokens
    const unicodeChars = Array.from(text).filter(char => char.charCodeAt(0) > 127).length
    const asciiChars = charCount - unicodeChars

    // ASCII chars: ~4 per token, Unicode: ~2 per token (rough)
    const asciiTokens = Math.ceil(asciiChars / this.charsPerToken)
    const unicodeTokens = Math.ceil(unicodeChars / 2)

    return asciiTokens + unicodeTokens
  }

  /**
   * Count tokens in a message array including formatting overhead
   */
  countMessageTokens(messages: Message[], model?: string): number {
    let total = 0

    for (const message of messages) {
      // Content tokens
      total += this.estimateTokens(message.content, model)
      // Role tokens (user, assistant, system)
      total += this.estimateTokens(message.role, model)
      // Message formatting overhead
      total += this.messageOverhead
    }

    return total
  }
}

// ============================================================================
// Budget Exceeded Error
// ============================================================================

/**
 * Error thrown when budget is exceeded
 */
export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly type: 'tokens' | 'cost',
    public readonly limit: number,
    public readonly current: number,
    public readonly requested?: number
  ) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

// ============================================================================
// Budget Tracker
// ============================================================================

/**
 * Tracks token usage and costs with budget limits
 */
export class BudgetTracker {
  private totalInputTokens = 0
  private totalOutputTokens = 0
  private usageByModel: Record<string, { inputTokens: number; outputTokens: number; cost: number }> = {}
  private triggeredThresholds: Set<number> = new Set()
  private requests: StoredRequest[] = []

  private readonly config: BudgetConfig

  constructor(config: BudgetConfig = {}) {
    this.config = {
      maxRequestHistory: 100,
      ...config,
    }
  }

  /**
   * Record token usage from a request
   */
  recordUsage(usage: TokenUsage): void {
    const { inputTokens, outputTokens, model = 'default' } = usage

    this.totalInputTokens += inputTokens
    this.totalOutputTokens += outputTokens

    // Track by model
    if (!this.usageByModel[model]) {
      this.usageByModel[model] = { inputTokens: 0, outputTokens: 0, cost: 0 }
    }
    this.usageByModel[model].inputTokens += inputTokens
    this.usageByModel[model].outputTokens += outputTokens

    // Calculate cost for this usage
    const pricing = this.getPricing(model)
    const cost = this.calculateCost(inputTokens, outputTokens, pricing)
    this.usageByModel[model].cost += cost

    // Check for budget exceeded
    this.checkLimitsAfterRecording()

    // Check for alerts
    this.checkAlerts()
  }

  /**
   * Record a complete request with timing info
   */
  recordRequest(info: RequestInfo): void {
    const duration = info.endTime - info.startTime
    const storedRequest: StoredRequest = {
      ...info,
      duration,
    }

    this.requests.push(storedRequest)

    // Trim history if needed
    const maxHistory = this.config.maxRequestHistory ?? 100
    while (this.requests.length > maxHistory) {
      this.requests.shift()
    }

    // Also record the token usage
    this.recordUsage({
      inputTokens: info.inputTokens,
      outputTokens: info.outputTokens,
      model: info.model,
    })
  }

  /**
   * Get all recorded requests
   */
  getRequests(): StoredRequest[] {
    return [...this.requests]
  }

  /**
   * Check if a proposed request would exceed budget
   */
  checkBudget(options: CheckBudgetOptions): void {
    const { estimatedTokens = 0, model = 'default' } = options

    // Check token limit
    if (this.config.maxTokens !== undefined) {
      const projectedTotal = this.getTotalTokens() + estimatedTokens
      if (projectedTotal > this.config.maxTokens) {
        throw new BudgetExceededError(
          `Token budget exceeded: ${projectedTotal} tokens would exceed limit of ${this.config.maxTokens}`,
          'tokens',
          this.config.maxTokens,
          this.getTotalTokens(),
          estimatedTokens
        )
      }
    }

    // Check cost limit
    if (this.config.maxCost !== undefined) {
      const pricing = this.getPricing(model)
      // Estimate cost assuming half input, half output
      const estimatedCost = this.calculateCost(
        Math.floor(estimatedTokens / 2),
        Math.ceil(estimatedTokens / 2),
        pricing
      )
      const projectedCost = this.getTotalCost() + estimatedCost

      if (projectedCost > this.config.maxCost) {
        throw new BudgetExceededError(
          `Cost budget exceeded: $${projectedCost.toFixed(4)} would exceed limit of $${this.config.maxCost}`,
          'cost',
          this.config.maxCost,
          this.getTotalCost(),
          estimatedCost
        )
      }
    }
  }

  /**
   * Check limits after recording and throw if exceeded
   */
  private checkLimitsAfterRecording(): void {
    // Check token limit
    if (this.config.maxTokens !== undefined) {
      if (this.getTotalTokens() > this.config.maxTokens) {
        throw new BudgetExceededError(
          `Token budget exceeded: ${this.getTotalTokens()} tokens exceeds limit of ${this.config.maxTokens}`,
          'tokens',
          this.config.maxTokens,
          this.getTotalTokens()
        )
      }
    }

    // Check cost limit
    if (this.config.maxCost !== undefined) {
      const currentCost = this.getTotalCost()
      if (currentCost > this.config.maxCost) {
        throw new BudgetExceededError(
          `Cost budget exceeded: $${currentCost.toFixed(4)} exceeds limit of $${this.config.maxCost}`,
          'cost',
          this.config.maxCost,
          currentCost
        )
      }
    }
  }

  /**
   * Check and trigger alerts
   */
  private checkAlerts(): void {
    if (!this.config.alertThresholds || !this.config.onAlert) return

    // Check token-based alerts
    if (this.config.maxTokens !== undefined) {
      const usage = this.getTotalTokens() / this.config.maxTokens

      for (const threshold of this.config.alertThresholds) {
        if (usage >= threshold && !this.triggeredThresholds.has(threshold)) {
          this.triggeredThresholds.add(threshold)
          this.config.onAlert({
            threshold,
            currentUsage: this.getTotalTokens(),
            limit: this.config.maxTokens,
            type: 'tokens',
          })
        }
      }
    }

    // Check cost-based alerts
    if (this.config.maxCost !== undefined) {
      const costUsage = this.getTotalCost() / this.config.maxCost

      for (const threshold of this.config.alertThresholds) {
        // Use a different key to not conflict with token thresholds
        const costThresholdKey = threshold + 1000
        if (costUsage >= threshold && !this.triggeredThresholds.has(costThresholdKey)) {
          this.triggeredThresholds.add(costThresholdKey)
          this.config.onAlert({
            threshold,
            currentUsage: this.getTotalCost(),
            limit: this.config.maxCost,
            type: 'cost',
          })
        }
      }
    }
  }

  /**
   * Get total input tokens
   */
  getTotalInputTokens(): number {
    return this.totalInputTokens
  }

  /**
   * Get total output tokens
   */
  getTotalOutputTokens(): number {
    return this.totalOutputTokens
  }

  /**
   * Get total tokens (input + output)
   */
  getTotalTokens(): number {
    return this.totalInputTokens + this.totalOutputTokens
  }

  /**
   * Get total cost in USD
   */
  getTotalCost(): number {
    let total = 0
    for (const model of Object.keys(this.usageByModel)) {
      total += this.usageByModel[model].cost
    }
    return total
  }

  /**
   * Get cost breakdown by model
   */
  getCostByModel(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const model of Object.keys(this.usageByModel)) {
      result[model] = this.usageByModel[model].cost
    }
    return result
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): RemainingBudget {
    const result: RemainingBudget = {}

    if (this.config.maxTokens !== undefined) {
      result.tokens = Math.max(0, this.config.maxTokens - this.getTotalTokens())
    }

    if (this.config.maxCost !== undefined) {
      result.cost = Math.max(0, this.config.maxCost - this.getTotalCost())
    }

    return result
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.totalInputTokens = 0
    this.totalOutputTokens = 0
    this.usageByModel = {}
    this.triggeredThresholds.clear()
    this.requests = []
  }

  /**
   * Export current state for persistence
   */
  export(): BudgetSnapshot {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCost: this.getTotalCost(),
      usageByModel: { ...this.usageByModel },
      triggeredThresholds: Array.from(this.triggeredThresholds),
    }
  }

  /**
   * Import previously exported state
   */
  import(snapshot: BudgetSnapshot): void {
    this.totalInputTokens = snapshot.totalInputTokens
    this.totalOutputTokens = snapshot.totalOutputTokens
    this.usageByModel = { ...snapshot.usageByModel }
    this.triggeredThresholds = new Set(snapshot.triggeredThresholds)
  }

  /**
   * Get pricing for a model
   */
  private getPricing(model: string): ModelPricing {
    // Check custom pricing first
    if (this.config.customPricing?.[model]) {
      return this.config.customPricing[model]
    }

    // Check default pricing
    if (DEFAULT_MODEL_PRICING[model]) {
      return DEFAULT_MODEL_PRICING[model]
    }

    // Fallback to default
    return DEFAULT_MODEL_PRICING['default']
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(inputTokens: number, outputTokens: number, pricing: ModelPricing): number {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion
    return inputCost + outputCost
  }
}

// ============================================================================
// Request Context
// ============================================================================

/**
 * Request context for tracing and user isolation
 */
export class RequestContext implements IRequestContext {
  readonly requestId: string
  readonly userId?: string
  readonly tenantId?: string
  readonly parentRequestId?: string
  readonly depth: number
  readonly metadata?: Record<string, unknown>

  private readonly traceId: string
  private readonly spanId: string

  constructor(options: RequestContextOptions & { depth?: number } = {}) {
    this.requestId = options.requestId ?? randomUUID()
    this.userId = options.userId
    this.tenantId = options.tenantId
    this.parentRequestId = options.parentRequestId
    this.depth = (options as { depth?: number }).depth ?? 0
    this.metadata = options.metadata

    // Generate trace/span IDs for W3C traceparent
    this.traceId = randomUUID().replace(/-/g, '')
    this.spanId = randomUUID().replace(/-/g, '').slice(0, 16)
  }

  /**
   * Create a child context that inherits from this one
   */
  createChild(options: Partial<RequestContextOptions> = {}): RequestContext {
    // Destructure to separate metadata from other options
    const { metadata: childMetadata, ...restOptions } = options

    return new RequestContext({
      userId: this.userId,
      tenantId: this.tenantId,
      parentRequestId: this.requestId,
      ...restOptions,
      metadata: {
        ...this.metadata,
        ...childMetadata,
      },
      depth: this.depth + 1,
    } as RequestContextOptions & { depth: number })
  }

  /**
   * Serialize to trace headers
   */
  toTraceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-request-id': this.requestId,
    }

    if (this.userId) {
      headers['x-user-id'] = this.userId
    }

    if (this.tenantId) {
      headers['x-tenant-id'] = this.tenantId
    }

    if (this.parentRequestId) {
      headers['x-parent-request-id'] = this.parentRequestId
    }

    return headers
  }

  /**
   * Generate W3C traceparent header
   * Format: version-trace_id-parent_id-flags
   */
  toTraceparent(): string {
    const version = '00'
    const flags = '01' // sampled
    return `${version}-${this.traceId}-${this.spanId}-${flags}`
  }

  /**
   * Create a RequestContext from trace headers
   */
  static fromHeaders(headers: Record<string, string>): RequestContext {
    return new RequestContext({
      requestId: headers['x-request-id'],
      userId: headers['x-user-id'],
      tenantId: headers['x-tenant-id'],
      parentRequestId: headers['x-parent-request-id'],
    })
  }
}

/**
 * Create a new request context
 */
export function createRequestContext(options: RequestContextOptions = {}): RequestContext {
  return new RequestContext(options)
}

// ============================================================================
// withBudget Wrapper
// ============================================================================

/** Options for withBudget */
export interface WithBudgetOptions extends BudgetConfig {
  userId?: string
  tenantId?: string
}

// Track nested budget contexts
let currentBudgetTracker: BudgetTracker | null = null

/**
 * Execute a function with budget tracking
 *
 * @example
 * ```ts
 * const result = await withBudget({ maxTokens: 1000 }, async (tracker) => {
 *   tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
 *   return 'success'
 * })
 * ```
 */
export async function withBudget<T>(
  options: WithBudgetOptions,
  fn: (tracker: BudgetTracker, ctx?: RequestContext) => Promise<T>
): Promise<T> {
  const { userId, tenantId, ...budgetConfig } = options

  const tracker = new BudgetTracker(budgetConfig)
  const ctx = userId || tenantId ? createRequestContext({ userId, tenantId }) : undefined

  // Track parent tracker for nested contexts
  const parentTracker = currentBudgetTracker

  // Create a wrapper tracker that propagates to parent
  const wrappedTracker = new Proxy(tracker, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      // Wrap recordUsage to propagate to parent
      if (prop === 'recordUsage' && parentTracker) {
        return (usage: TokenUsage) => {
          target.recordUsage(usage)
          parentTracker.recordUsage(usage)
        }
      }

      return value
    },
  })

  currentBudgetTracker = tracker

  try {
    return await fn(wrappedTracker, ctx)
  } finally {
    currentBudgetTracker = parentTracker
  }
}
