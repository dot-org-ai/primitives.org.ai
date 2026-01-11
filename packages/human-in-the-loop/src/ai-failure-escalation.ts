/**
 * AI Failure to Human Escalation Integration
 *
 * This module provides primitives for integrating AI failures with human escalation:
 * - AIFailureClassifier: Classify AI errors into categories and map to escalation tiers
 * - ContextSanitizer: Extract and sanitize context for human review
 * - AutoEscalationTrigger: Trigger escalation based on failure patterns
 * - EscalationRouter: Route failures to appropriate human reviewers
 */

import type { Priority, HumanRequest, ReviewRequest, ReviewResponse } from './types.js'
import type { HumanManager } from './human.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Failure category
 */
export type FailureCategory = 'recoverable' | 'critical' | 'unknown'

/**
 * Failure severity levels
 */
export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Cascade tier identifier (string union type for simplified tier references)
 */
export type CascadeTierId = 'code' | 'generative' | 'agentic' | 'human'

/**
 * AI failure information
 */
export interface AIFailure {
  /** Error code */
  code: string
  /** Error message */
  message: string
  /** When the failure occurred */
  timestamp: Date
  /** Additional context */
  context?: Record<string, unknown>
  /** Original error object */
  error?: Error
}

/**
 * Custom failure type configuration
 */
export interface FailureTypeConfig {
  /** Failure code */
  code: string
  /** Tier to route to */
  tier: CascadeTierId
  /** Category */
  category: FailureCategory
  /** Severity */
  severity: FailureSeverity
  /** Description */
  description?: string
}

/**
 * Category rule function
 */
export type CategoryRule = (failure: AIFailure) => boolean

/**
 * Sanitized context for human review
 */
export interface SanitizedContext {
  failureCode?: string
  failureMessage?: string
  model?: string
  requestId?: string
  stackTrace?: string
  timestamp?: Date
  environment?: string
  correlationId?: string
  [key: string]: unknown
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  /** Number of consecutive failures before escalation */
  consecutiveFailureThreshold?: number
  /** Failure rate threshold (0-1) */
  failureRateThreshold?: number
  /** Minimum sample size for rate calculation */
  minSampleSize?: number
  /** Time window in milliseconds */
  windowMs: number
  /** Cooldown period after escalation */
  cooldownMs?: number
  /** Per-error-code thresholds */
  thresholds?: Record<string, { consecutiveFailureThreshold?: number; failureRateThreshold?: number }>
  /** Callback when escalation is triggered */
  onEscalation?: (event: EscalationEvent) => void
  /** Routing rules for escalation */
  routingRules?: Array<{ pattern: RegExp; tier: CascadeTierId }>
}

/**
 * Escalation event emitted when escalation is triggered
 */
export interface EscalationEvent {
  /** Failure code that triggered escalation */
  failureCode: string
  /** Number of failures */
  failureCount: number
  /** When escalation was triggered */
  triggeredAt: Date
  /** Recent failures */
  recentFailures: FailureRecord[]
}

/**
 * Record of a failure for tracking
 */
export interface FailureRecord {
  /** Failure code */
  code: string
  /** Request ID */
  requestId: string
  /** Timestamp */
  timestamp: Date
  /** Whether it was a success */
  success: boolean
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Escalation route information
 */
export interface EscalationRoute {
  /** Target tier */
  tier: CascadeTierId
  /** Reason for routing */
  reason?: string
}

/**
 * Human reviewer configuration
 */
export interface ReviewerConfig {
  /** Reviewer ID */
  id: string
  /** Reviewer name */
  name: string
  /** Tiers this reviewer can handle */
  tiers: CascadeTierId[]
  /** Capabilities */
  capabilities?: string[]
  /** Whether reviewer is available */
  available?: boolean
  /** Whether reviewer is on-call */
  isOnCall?: boolean
}

/**
 * Routing metrics
 */
export interface RoutingMetrics {
  /** Metrics by tier */
  byTier: Record<string, { routingCount: number }>
  /** Metrics by reviewer */
  byReviewer: Record<string, { assignmentCount: number }>
}

/**
 * Escalation request parameters
 */
export interface EscalationRequestParams {
  /** The AI failure */
  failure: AIFailure
  /** Target tier */
  tier: CascadeTierId
  /** Priority */
  priority: Priority
  /** Request title */
  title?: string
  /** Request description */
  description?: string
}

/**
 * Created escalation request
 */
export interface CreatedEscalationRequest {
  /** Request ID */
  id: string
  /** Request type */
  type: 'review'
  /** Priority */
  priority: Priority
  /** Assignee ID */
  assignee: string
  /** Metadata */
  metadata?: Record<string, unknown>
}

// =============================================================================
// AIFailureClassifier
// =============================================================================

/**
 * Default tier mappings for common AI error codes
 */
const DEFAULT_TIER_MAPPINGS: Record<string, CascadeTierId> = {
  // Code tier (retry/fallback)
  'rate_limit_exceeded': 'code',
  'timeout': 'code',
  'service_unavailable': 'code',
  'network_error': 'code',

  // Generative tier (regenerate)
  'invalid_output_format': 'generative',
  'content_filter_triggered': 'generative',
  'hallucination_detected': 'generative',
  'parsing_error': 'generative',

  // Agentic tier (autonomous problem solving)
  'reasoning_loop_detected': 'agentic',
  'context_overflow': 'agentic',
  'task_complexity_exceeded': 'agentic',

  // Human tier (manual intervention)
  'safety_violation': 'human',
  'approval_required': 'human',
  'data_integrity_error': 'human',
  'policy_violation': 'human',
}

/**
 * Default category mappings
 */
const DEFAULT_CATEGORY_MAPPINGS: Record<string, FailureCategory> = {
  'rate_limit_exceeded': 'recoverable',
  'timeout': 'recoverable',
  'service_unavailable': 'recoverable',
  'network_error': 'recoverable',
  'invalid_output_format': 'recoverable',
  'content_filter_triggered': 'recoverable',
  'hallucination_detected': 'recoverable',
  'parsing_error': 'recoverable',
  'reasoning_loop_detected': 'recoverable',
  'context_overflow': 'recoverable',
  'task_complexity_exceeded': 'recoverable',
  'safety_violation': 'critical',
  'approval_required': 'critical',
  'data_integrity_error': 'critical',
  'policy_violation': 'critical',
}

/**
 * Default severity mappings
 */
const DEFAULT_SEVERITY_MAPPINGS: Record<string, FailureSeverity> = {
  'rate_limit_exceeded': 'low',
  'timeout': 'low',
  'service_unavailable': 'low',
  'network_error': 'low',
  'invalid_output_format': 'medium',
  'content_filter_triggered': 'medium',
  'hallucination_detected': 'medium',
  'parsing_error': 'medium',
  'reasoning_loop_detected': 'high',
  'context_overflow': 'high',
  'task_complexity_exceeded': 'high',
  'safety_violation': 'critical',
  'approval_required': 'high',
  'data_integrity_error': 'critical',
  'policy_violation': 'critical',
}

/**
 * Classifies AI failures into categories and maps them to escalation tiers
 */
export class AIFailureClassifier {
  private tierMappings: Map<string, CascadeTierId> = new Map()
  private categoryMappings: Map<string, FailureCategory> = new Map()
  private severityMappings: Map<string, FailureSeverity> = new Map()
  private categoryRules: Array<{ rule: CategoryRule; category: FailureCategory }> = []
  private failureTracker: Map<string, number> = new Map()
  private frequencyThreshold = 3

  constructor() {
    // Initialize with default mappings
    for (const [code, tier] of Object.entries(DEFAULT_TIER_MAPPINGS)) {
      this.tierMappings.set(code, tier)
    }
    for (const [code, category] of Object.entries(DEFAULT_CATEGORY_MAPPINGS)) {
      this.categoryMappings.set(code, category)
    }
    for (const [code, severity] of Object.entries(DEFAULT_SEVERITY_MAPPINGS)) {
      this.severityMappings.set(code, severity)
    }
  }

  /**
   * Map an AI error code to an escalation tier
   */
  mapToTier(code: string): CascadeTierId | undefined {
    return this.tierMappings.get(code)
  }

  /**
   * Register a custom mapping from error code to tier
   */
  registerMapping(code: string, tier: CascadeTierId): void {
    this.tierMappings.set(code, tier)
  }

  /**
   * Categorize a failure
   */
  categorize(failure: AIFailure): FailureCategory {
    // Check custom rules first
    for (const { rule, category } of this.categoryRules) {
      if (rule(failure)) {
        return category
      }
    }

    // Check default mappings
    const category = this.categoryMappings.get(failure.code)
    if (category) {
      return category
    }

    return 'unknown'
  }

  /**
   * Register a custom category rule
   */
  registerCategoryRule(rule: CategoryRule, category: FailureCategory): void {
    this.categoryRules.push({ rule, category })
  }

  /**
   * Assess the severity of a failure
   */
  assessSeverity(failure: AIFailure, options?: { checkFrequency?: boolean }): FailureSeverity {
    // Check for elevated severity due to frequency
    if (options?.checkFrequency) {
      const count = this.failureTracker.get(failure.code) || 0
      if (count >= this.frequencyThreshold) {
        const baseSeverity = this.severityMappings.get(failure.code) || 'low'
        // Elevate severity
        if (baseSeverity === 'low') return 'medium'
        if (baseSeverity === 'medium') return 'high'
        return baseSeverity
      }
    }

    return this.severityMappings.get(failure.code) || 'low'
  }

  /**
   * Track a failure for frequency analysis
   */
  trackFailure(failure: AIFailure): void {
    const count = this.failureTracker.get(failure.code) || 0
    this.failureTracker.set(failure.code, count + 1)
  }

  /**
   * Register a custom failure type with full configuration
   */
  registerFailureType(config: FailureTypeConfig): void {
    this.tierMappings.set(config.code, config.tier)
    this.categoryMappings.set(config.code, config.category)
    this.severityMappings.set(config.code, config.severity)
  }

  /**
   * Unregister a failure type
   */
  unregisterFailureType(code: string): void {
    this.tierMappings.delete(code)
    this.categoryMappings.delete(code)
    this.severityMappings.delete(code)
  }

  /**
   * List all registered failure types
   */
  listFailureTypes(): string[] {
    return Array.from(this.tierMappings.keys())
  }
}

// =============================================================================
// ContextSanitizer
// =============================================================================

/**
 * Options for ContextSanitizer
 */
export interface ContextSanitizerOptions {
  /** Whether to redact email addresses */
  redactEmails?: boolean
}

/**
 * Redaction pattern configuration
 */
interface RedactionPattern {
  pattern: RegExp
  name: string
}

/**
 * Default patterns for sensitive data
 */
const DEFAULT_SENSITIVE_KEYS = [
  'apiKey',
  'api_key',
  'apikey',
  'password',
  'dbPassword',
  'db_password',
  'secret',
  'secretKey',
  'secret_key',
  'authorization',
  'Authorization',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'credential',
  'credentials',
]

/**
 * Credit card pattern
 */
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g

/**
 * Email pattern
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

/**
 * Sanitizes context data before human review by removing sensitive information
 */
export class ContextSanitizer {
  private options: ContextSanitizerOptions
  private customPatterns: RedactionPattern[] = []

  constructor(options: ContextSanitizerOptions = {}) {
    this.options = options
  }

  /**
   * Extract relevant context from an AI failure
   */
  extractContext(failure: AIFailure, options?: { includeStackTrace?: boolean }): SanitizedContext {
    const context: SanitizedContext = {
      failureCode: failure.code,
      failureMessage: failure.message,
    }

    if (failure.context) {
      if (failure.context['model']) {
        context.model = failure.context['model'] as string
      }
      if (failure.context['requestId']) {
        context.requestId = failure.context['requestId'] as string
      }
    }

    if (options?.includeStackTrace && failure.error) {
      context.stackTrace = failure.error.stack
    }

    return context
  }

  /**
   * Sanitize context by redacting sensitive data
   */
  sanitize<T extends Record<string, unknown>>(context: T): T {
    return this.sanitizeValue(context) as T
  }

  /**
   * Recursively sanitize a value
   */
  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item))
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        // If it's a sensitive key with a primitive (string) value, redact it
        if (this.isSensitiveKey(key) && typeof val !== 'object') {
          result[key] = '[REDACTED]'
        } else if (typeof val === 'string') {
          result[key] = this.sanitizeString(val)
        } else {
          // Recurse into nested objects/arrays
          result[key] = this.sanitizeValue(val)
        }
      }
      return result
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value)
    }

    return value
  }

  /**
   * Check if a key is sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase()
    return DEFAULT_SENSITIVE_KEYS.some((sensitive) =>
      lowerKey.includes(sensitive.toLowerCase())
    )
  }

  /**
   * Sanitize a string by replacing patterns
   */
  private sanitizeString(str: string): string {
    let result = str

    // Redact credit card numbers
    result = result.replace(CREDIT_CARD_PATTERN, '[REDACTED]')

    // Redact emails if configured
    if (this.options.redactEmails) {
      result = result.replace(EMAIL_PATTERN, '[REDACTED]')
    }

    // Apply custom patterns
    for (const { pattern } of this.customPatterns) {
      result = result.replace(pattern, '[REDACTED]')
    }

    return result
  }

  /**
   * Add a custom redaction pattern
   */
  addRedactionPattern(pattern: RegExp, name: string): void {
    this.customPatterns.push({ pattern, name })
  }

  /**
   * Enrich context with metadata
   */
  enrich<T extends Record<string, unknown>>(
    context: T,
    options?: {
      includeEnvironment?: boolean
      environment?: string
      correlationId?: string
    }
  ): T & { timestamp: Date; requestId: string; environment?: string; correlationId?: string } {
    const enriched = {
      ...context,
      timestamp: new Date(),
      requestId: (context['requestId'] as string) || this.generateRequestId(),
    } as T & { timestamp: Date; requestId: string; environment?: string; correlationId?: string }

    if (options?.includeEnvironment && options.environment) {
      enriched.environment = options.environment
    }

    if (options?.correlationId) {
      enriched.correlationId = options.correlationId
    }

    return enriched
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
}

// =============================================================================
// AutoEscalationTrigger
// =============================================================================

/**
 * Triggers escalation based on failure patterns and thresholds
 */
export class AutoEscalationTrigger {
  private config: EscalationConfig = { windowMs: 60000 }
  private failureRecords: Map<string, FailureRecord[]> = new Map()
  private cooldowns: Map<string, number> = new Map()

  /**
   * Configure the escalation trigger
   */
  configure(config: EscalationConfig): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Record a failure
   */
  recordFailure(params: { code: string; requestId: string; context?: Record<string, unknown> }): void {
    const record: FailureRecord = {
      code: params.code,
      requestId: params.requestId,
      timestamp: new Date(),
      success: false,
      context: params.context,
    }

    const records = this.failureRecords.get(params.code) || []
    records.push(record)
    this.failureRecords.set(params.code, records)
  }

  /**
   * Record a success
   * For consecutive failure threshold: resets the failure streak
   * For rate-based threshold: adds a success record to calculate rate
   */
  recordSuccess(params: { code: string; requestId: string }): void {
    const records = this.failureRecords.get(params.code) || []

    // If using rate-based threshold, add success record
    if (this.config.failureRateThreshold !== undefined) {
      const record: FailureRecord = {
        code: params.code,
        requestId: params.requestId,
        timestamp: new Date(),
        success: true,
      }
      records.push(record)
      this.failureRecords.set(params.code, records)
    } else {
      // For consecutive failure threshold, success resets the streak
      this.failureRecords.set(params.code, [])
    }
  }

  /**
   * Check if escalation should be triggered
   */
  shouldEscalate(code: string): boolean {
    // Check cooldown
    const cooldownEnd = this.cooldowns.get(code)
    if (cooldownEnd && Date.now() < cooldownEnd) {
      return false
    }

    const records = this.getRecentRecords(code)
    const threshold = this.getThresholdForCode(code)

    // Check consecutive failure threshold
    if (threshold.consecutiveFailureThreshold !== undefined) {
      const failures = records.filter((r) => !r.success)
      if (failures.length >= threshold.consecutiveFailureThreshold) {
        return true
      }
    }

    // Check failure rate threshold
    if (threshold.failureRateThreshold !== undefined && this.config.minSampleSize !== undefined) {
      if (records.length >= this.config.minSampleSize) {
        const failures = records.filter((r) => !r.success)
        const rate = failures.length / records.length
        if (rate >= threshold.failureRateThreshold) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Get records within the time window
   */
  private getRecentRecords(code: string): FailureRecord[] {
    const records = this.failureRecords.get(code) || []
    const windowStart = Date.now() - this.config.windowMs

    return records.filter((r) => r.timestamp.getTime() >= windowStart)
  }

  /**
   * Get threshold for a specific code
   */
  private getThresholdForCode(code: string): {
    consecutiveFailureThreshold?: number
    failureRateThreshold?: number
  } {
    if (this.config.thresholds?.[code]) {
      return this.config.thresholds[code]!
    }

    return {
      consecutiveFailureThreshold: this.config.consecutiveFailureThreshold,
      failureRateThreshold: this.config.failureRateThreshold,
    }
  }

  /**
   * Acknowledge escalation (starts cooldown)
   */
  acknowledgeEscalation(code: string): void {
    if (this.config.cooldownMs) {
      this.cooldowns.set(code, Date.now() + this.config.cooldownMs)
    }
    // Reset failure records
    this.failureRecords.set(code, [])
  }

  /**
   * Check and trigger escalation
   */
  checkAndEscalate(code: string): void {
    if (this.shouldEscalate(code) && this.config.onEscalation) {
      const records = this.getRecentRecords(code)
      const failures = records.filter((r) => !r.success)

      this.config.onEscalation({
        failureCode: code,
        failureCount: failures.length,
        triggeredAt: new Date(),
        recentFailures: failures,
      })
    }
  }

  /**
   * Get escalation route based on routing rules
   */
  getEscalationRoute(code: string): EscalationRoute | undefined {
    if (!this.config.routingRules) {
      return undefined
    }

    for (const rule of this.config.routingRules) {
      if (rule.pattern.test(code)) {
        return { tier: rule.tier }
      }
    }

    return undefined
  }
}

// =============================================================================
// EscalationRouter
// =============================================================================

/**
 * Routes AI failures to appropriate human reviewers
 */
export class EscalationRouter {
  private reviewers: Map<string, ReviewerConfig> = new Map()
  private metrics: RoutingMetrics = { byTier: {}, byReviewer: {} }
  private humanManager?: HumanManager

  /**
   * Set the HumanManager for request creation
   */
  setHumanManager(manager: HumanManager): void {
    this.humanManager = manager
  }

  /**
   * Register a human reviewer
   */
  registerReviewer(config: ReviewerConfig): void {
    this.reviewers.set(config.id, {
      ...config,
      available: config.available ?? true,
    })
  }

  /**
   * Get reviewers for a specific tier
   */
  getReviewersForTier(tier: CascadeTierId): ReviewerConfig[] {
    return Array.from(this.reviewers.values()).filter((r) =>
      r.tiers.includes(tier)
    )
  }

  /**
   * Get reviewers by capability
   */
  getReviewersByCapability(capability: string): ReviewerConfig[] {
    return Array.from(this.reviewers.values()).filter((r) =>
      r.capabilities?.includes(capability)
    )
  }

  /**
   * Get available reviewers for a tier
   */
  getAvailableReviewers(tier: CascadeTierId): ReviewerConfig[] {
    const tierReviewers = this.getReviewersForTier(tier)
    const available = tierReviewers.filter((r) => r.available)

    // If no one is available, check for on-call reviewers
    if (available.length === 0) {
      const onCall = Array.from(this.reviewers.values()).filter(
        (r) => r.isOnCall && r.tiers.includes(tier)
      )
      return onCall
    }

    return available
  }

  /**
   * Create an escalation request
   */
  async createEscalationRequest(params: EscalationRequestParams): Promise<CreatedEscalationRequest> {
    const reviewers = this.getAvailableReviewers(params.tier)
    const assignee = reviewers[0]?.id || ''

    const request: CreatedEscalationRequest = {
      id: `esc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'review',
      priority: params.priority,
      assignee,
      metadata: {
        failureCode: params.failure.code,
        failureMessage: params.failure.message,
        tier: params.tier,
      },
    }

    return request
  }

  /**
   * Escalate for human review using HumanManager
   */
  async escalateForReview(params: EscalationRequestParams): Promise<ReviewResponse | undefined> {
    if (!this.humanManager) {
      throw new Error('HumanManager not configured')
    }

    const reviewers = this.getAvailableReviewers(params.tier)
    const assignee = reviewers[0]?.id

    return this.humanManager.review({
      title: params.title || `Review: ${params.failure.code}`,
      description: params.description || params.failure.message,
      content: {
        failure: params.failure,
        tier: params.tier,
      },
      assignee,
      priority: params.priority,
    })
  }

  /**
   * Record a routing event
   */
  recordRouting(tier: string, reviewerId: string): void {
    // Update tier metrics
    if (!this.metrics.byTier[tier]) {
      this.metrics.byTier[tier] = { routingCount: 0 }
    }
    this.metrics.byTier[tier]!.routingCount++

    // Update reviewer metrics
    if (!this.metrics.byReviewer[reviewerId]) {
      this.metrics.byReviewer[reviewerId] = { assignmentCount: 0 }
    }
    this.metrics.byReviewer[reviewerId]!.assignmentCount++
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics }
  }
}
