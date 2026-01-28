/**
 * Error Escalation
 *
 * Multi-level error escalation between agent tiers with classification,
 * routing, and recovery patterns.
 *
 * ## Key Concepts
 *
 * 1. **Error Classification** - Categorize errors by severity and type
 * 2. **Escalation Routing** - Determine next tier for escalation
 * 3. **Recovery Patterns** - Retry, fallback, and degradation strategies
 *
 * ## Escalation Flow
 *
 * ```
 * Error -> Classify -> Should Retry? -> Retry with Backoff
 *                   -> Exhausted -> Should Escalate? -> Escalate to Next Tier
 *                                -> At Terminal -> Fallback or Degrade
 * ```
 *
 * @packageDocumentation
 */

import type { CapabilityTier } from './capability-tiers.js'
import { getNextTier, TIER_ORDER } from './capability-tiers.js'

// ============================================================================
// Type Definitions - Error Classification
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error category types
 */
export type ErrorCategory = 'transient' | 'permanent' | 'escalatable'

/**
 * Degradation level for graceful degradation
 */
export type DegradationLevel = 'none' | 'partial' | 'significant' | 'full'

/**
 * Options for determining error severity
 */
export interface SeverityOptions {
  isRetryable?: boolean
  impact?: 'single-task' | 'workflow' | 'system'
}

/**
 * Classified error with metadata
 */
export interface ClassifiedError {
  id: string
  original: Error
  severity: ErrorSeverity
  category: ErrorCategory
  tier?: CapabilityTier
  agentId?: string
  taskId?: string
  timestamp: Date
  stack?: string
  previousError?: ClassifiedError
  context?: ErrorContext
}

/**
 * Error context for preservation through escalation
 */
export interface ErrorContext {
  workflowId?: string
  stepId?: string
  attemptNumber?: number
  startTime?: Date
  metadata?: Record<string, unknown>
}

/**
 * Error chain type
 */
export type ErrorChain = ClassifiedError[]

/**
 * Options for building error chain
 */
export interface ErrorChainOptions {
  maxDepth?: number
}

// ============================================================================
// Type Definitions - Escalation Routing
// ============================================================================

/**
 * Escalation path definition
 */
export interface EscalationPath {
  fromTier: CapabilityTier
  toTier: CapabilityTier
  reason: string
  isTerminal?: boolean
}

/**
 * Escalation rule definition
 */
export interface EscalationRule {
  name: string
  fromTier: CapabilityTier
  toTier: CapabilityTier
  condition: (error: ClassifiedError) => boolean
  priority?: number
}

/**
 * Tier-specific policy configuration
 */
export interface TierPolicyConfig {
  maxRetries?: number
  timeout?: number
  allowedCategories?: ErrorCategory[]
}

/**
 * Escalation policy configuration
 */
export interface EscalationPolicy {
  maxEscalationDepth: number
  allowSkipTiers: boolean
  skipTierThreshold?: ErrorSeverity
  rules: EscalationRule[]
  tierPolicies?: Partial<Record<CapabilityTier, TierPolicyConfig>>
}

/**
 * Options for creating escalation policy
 */
export interface EscalationPolicyOptions {
  maxEscalationDepth?: number
  allowSkipTiers?: boolean
  skipTierThreshold?: ErrorSeverity
  rules?: EscalationRule[]
  tierPolicies?: Partial<Record<CapabilityTier, TierPolicyConfig>>
}

/**
 * Escalation threshold configuration
 */
export interface EscalationThreshold {
  errorCount: number
  timeWindow?: number
  severityMultiplier?: Partial<Record<ErrorSeverity, number>>
}

/**
 * Error history entry for threshold checking
 */
export interface ErrorHistoryEntry {
  timestamp: number
  severity?: ErrorSeverity
}

/**
 * Escalation validation result
 */
export interface EscalationValidationResult {
  valid: boolean
  error?: string
}

/**
 * Escalation result from engine
 */
export interface EscalationResult {
  handled: boolean
  action: 'retry' | 'escalate' | 'fallback' | 'degrade' | 'terminal'
  classifiedError: ClassifiedError
  retryDelay?: number
  escalationPath?: EscalationPath
  fallbackAgent?: AgentForFallback
  degradationLevel?: DegradationLevel
  preservedContext?: ErrorContext
  errorChain?: ErrorChain
}

// ============================================================================
// Type Definitions - Recovery Patterns
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs?: number
  backoffMultiplier?: number
  jitterPercent?: number
  retryableCategories?: ErrorCategory[]
}

/**
 * Retry state
 */
export interface RetryState {
  attemptNumber: number
  lastAttemptTime: Date | null
  nextRetryTime: Date | null
  exhausted: boolean
}

/**
 * Agent info for fallback selection
 */
export interface AgentForFallback {
  id: string
  tier: CapabilityTier
  skills?: string[]
  currentLoad?: number
  maxLoad?: number
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  strategy: 'capability-match' | 'least-loaded' | 'same-tier' | 'round-robin'
  requiredSkills?: string[]
  currentTier?: CapabilityTier
  excludeAgentIds?: string[]
}

/**
 * Degradation options
 */
export interface DegradationOptions {
  errorCount?: number
  threshold?: number
  rules?: Array<{
    condition: (severity: ErrorSeverity) => boolean
    level: DegradationLevel
  }>
}

/**
 * Recovery state
 */
export interface RecoveryState {
  errorId: string
  tier: CapabilityTier
  agentId?: string
  retryState: RetryState
  escalated: boolean
  resolved: boolean
  escalationPath: CapabilityTier[]
  fallbackHistory: string[]
  lastAction?: string
  resolution?: string
  isTerminal?: boolean
}

/**
 * Recovery state options
 */
export interface RecoveryStateOptions {
  errorId: string
  tier: CapabilityTier
  agentId?: string
}

/**
 * Recovery state update
 */
export interface RecoveryStateUpdate {
  type: 'retry' | 'escalate' | 'fallback' | 'resolve'
  success?: boolean
  exhausted?: boolean
  toTier?: CapabilityTier
  toAgentId?: string
  resolution?: string
  isTerminal?: boolean
}

// ============================================================================
// Type Definitions - Escalation Engine
// ============================================================================

/**
 * Escalation engine options
 */
export interface EscalationEngineOptions {
  policy?: EscalationPolicy
  retryConfig?: RetryConfig
}

/**
 * Error handling options
 */
export interface HandleErrorOptions {
  tier: CapabilityTier
  agentId?: string
  taskId?: string
  severity?: ErrorSeverity
  retryState?: RetryState
  escalationHistory?: CapabilityTier[]
  previousError?: ClassifiedError
  context?: ErrorContext
  availableAgents?: AgentForFallback[]
  simulateRetrySuccess?: boolean
  simulateRetryFailure?: boolean
}

/**
 * Escalation metrics
 */
export interface EscalationMetrics {
  totalErrors: number
  bySeverity: Record<ErrorSeverity, number>
  escalationsByTier: Record<string, number>
  retrySuccessRate: number
  retriesTotal: number
  retriesSuccessful: number
}

/**
 * Escalation engine interface
 */
export interface EscalationEngine {
  handleError(error: Error, options: HandleErrorOptions): Promise<EscalationResult>
  getMetrics(): EscalationMetrics
  reset(): void
}

// ============================================================================
// Error Classification Implementation
// ============================================================================

let errorIdCounter = 0

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return `err-${Date.now()}-${++errorIdCounter}`
}

/**
 * Get error severity based on error and options
 */
export function getErrorSeverity(error: Error, options: SeverityOptions = {}): ErrorSeverity {
  const { isRetryable = true, impact = 'single-task' } = options

  // Critical: system-wide impact and not retryable
  if (impact === 'system' && !isRetryable) {
    return 'critical'
  }

  // High: workflow impact and not retryable
  if (impact === 'workflow' && !isRetryable) {
    return 'high'
  }

  // Medium: workflow impact but retryable
  if (impact === 'workflow' && isRetryable) {
    return 'medium'
  }

  // Low: single-task impact
  return 'low'
}

/**
 * Get error category based on error type
 */
export function getErrorCategory(error: Error): ErrorCategory {
  const name = error.name || ''
  const message = error.message || ''

  // Permanent errors - configuration, validation, etc.
  if (
    name.includes('Configuration') ||
    name.includes('Validation') ||
    name.includes('Invalid') ||
    message.includes('invalid')
  ) {
    return 'permanent'
  }

  // Escalatable errors - require higher tier
  if (
    name.includes('Approval') ||
    name.includes('Escalation') ||
    message.includes('approval') ||
    message.includes('human')
  ) {
    return 'escalatable'
  }

  // Default to transient (retryable)
  return 'transient'
}

/**
 * Create a classified error
 */
export function createClassifiedError(
  original: Error,
  options: {
    severity: ErrorSeverity
    category: ErrorCategory
    tier?: CapabilityTier
    agentId?: string
    taskId?: string
    previousError?: ClassifiedError
    context?: ErrorContext
  }
): ClassifiedError {
  return {
    id: generateErrorId(),
    original,
    severity: options.severity,
    category: options.category,
    tier: options.tier,
    agentId: options.agentId,
    taskId: options.taskId,
    timestamp: new Date(),
    stack: original.stack,
    previousError: options.previousError,
    context: options.context,
  }
}

/**
 * Classify an error automatically
 */
export function classifyError(
  error: Error,
  options: Partial<{
    tier: CapabilityTier
    agentId: string
    taskId: string
    context: ErrorContext
  }> = {}
): ClassifiedError {
  const severity = getErrorSeverity(error)
  const category = getErrorCategory(error)

  return createClassifiedError(error, {
    severity,
    category,
    ...options,
  })
}

/**
 * Check if error is escalatable
 */
export function isEscalatable(error: ClassifiedError): boolean {
  // Critical errors are always escalatable
  if (error.severity === 'critical') {
    return true
  }

  // Escalatable category
  if (error.category === 'escalatable') {
    return true
  }

  // High severity transient errors
  if (error.severity === 'high' && error.category === 'transient') {
    return true
  }

  return false
}

/**
 * Preserve context through escalation
 */
export function preserveContext(
  context: ErrorContext,
  updates: Partial<ErrorContext> = {}
): ErrorContext {
  return {
    ...context,
    ...updates,
    metadata: {
      ...context.metadata,
      ...updates.metadata,
    },
  }
}

/**
 * Build error chain from escalation history
 */
export function buildErrorChain(
  error: ClassifiedError,
  options: ErrorChainOptions = {}
): ErrorChain {
  const { maxDepth = 50 } = options
  const chain: ErrorChain = []
  let current: ClassifiedError | undefined = error
  let depth = 0

  while (current && depth < maxDepth) {
    chain.unshift(current)
    current = current.previousError
    depth++
  }

  return chain
}

// ============================================================================
// Escalation Routing Implementation
// ============================================================================

const SEVERITY_ORDER: Record<ErrorSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/**
 * Create an escalation policy with defaults
 */
export function createEscalationPolicy(options: EscalationPolicyOptions): EscalationPolicy {
  return {
    maxEscalationDepth: options.maxEscalationDepth ?? 10,
    allowSkipTiers: options.allowSkipTiers ?? false,
    ...(options.skipTierThreshold !== undefined && {
      skipTierThreshold: options.skipTierThreshold,
    }),
    rules: options.rules ?? [],
    ...(options.tierPolicies !== undefined && { tierPolicies: options.tierPolicies }),
  }
}

/**
 * Get next escalation tier based on error and policy
 */
export function getNextEscalationTier(
  error: ClassifiedError,
  policy: EscalationPolicy
): CapabilityTier | null {
  const currentTier = error.tier ?? 'code'

  // Check custom rules first
  const applicableRules = policy.rules
    .filter((rule) => rule.fromTier === currentTier && rule.condition(error))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  if (applicableRules.length > 0) {
    return applicableRules[0]!.toTier
  }

  // Check if we should skip tiers
  if (
    policy.allowSkipTiers &&
    policy.skipTierThreshold &&
    SEVERITY_ORDER[error.severity] >= SEVERITY_ORDER[policy.skipTierThreshold]
  ) {
    return 'human'
  }

  // Default: go to next tier
  return getNextTier(currentTier)
}

/**
 * Determine escalation path for an error
 */
export function determineEscalationPath(
  error: ClassifiedError,
  policy?: EscalationPolicy
): EscalationPath {
  const fromTier = error.tier ?? 'code'
  const effectivePolicy = policy ?? createEscalationPolicy({})
  const nextTier = getNextEscalationTier(error, effectivePolicy)

  if (!nextTier || nextTier === fromTier) {
    return {
      fromTier,
      toTier: fromTier,
      reason: 'Cannot escalate further - at terminal tier',
      isTerminal: true,
    }
  }

  return {
    fromTier,
    toTier: nextTier,
    reason: `Escalating due to ${error.severity} severity ${error.category} error`,
  }
}

/**
 * Check if escalation should occur based on threshold
 */
export function shouldEscalate(
  threshold: EscalationThreshold,
  errorHistory: ErrorHistoryEntry[]
): boolean {
  const now = Date.now()
  const { errorCount, timeWindow, severityMultiplier } = threshold

  // Filter by time window if specified
  let relevantErrors = errorHistory
  if (timeWindow) {
    relevantErrors = errorHistory.filter((entry) => now - entry.timestamp <= timeWindow)
  }

  // Calculate weighted count if severity multiplier is specified
  if (severityMultiplier) {
    const weightedCount = relevantErrors.reduce((sum, entry) => {
      const multiplier = entry.severity ? severityMultiplier[entry.severity] ?? 1 : 1
      return sum + multiplier
    }, 0)
    return weightedCount >= errorCount
  }

  return relevantErrors.length >= errorCount
}

/**
 * Detect circular escalation
 */
export function detectCircularEscalation(path: EscalationPath, history: CapabilityTier[]): boolean {
  // If we're going back to a tier we've already visited, it's circular
  if (history.includes(path.toTier)) {
    return true
  }

  // Check for de-escalation (going to a lower tier)
  if (TIER_ORDER[path.toTier] < TIER_ORDER[path.fromTier]) {
    // If we've already been at a tier higher than where we're going, it's circular
    const maxTierVisited = Math.max(...history.map((t) => TIER_ORDER[t]))
    if (TIER_ORDER[path.toTier] < maxTierVisited) {
      return true
    }
  }

  return false
}

/**
 * Validate an escalation path
 */
export function validateEscalationPath(
  path: EscalationPath,
  history: CapabilityTier[],
  policy: EscalationPolicy
): EscalationValidationResult {
  // Check max depth
  if (history.length >= policy.maxEscalationDepth) {
    return {
      valid: false,
      error: `Escalation depth exceeded: max is ${policy.maxEscalationDepth}`,
    }
  }

  // Check for circular escalation
  if (detectCircularEscalation(path, history)) {
    return {
      valid: false,
      error: 'Circular escalation detected',
    }
  }

  return { valid: true }
}

// ============================================================================
// Recovery Patterns Implementation
// ============================================================================

/**
 * Calculate backoff delay with optional jitter
 */
export function calculateBackoff(config: RetryConfig, attemptNumber: number): number {
  const { baseDelayMs, maxDelayMs = Infinity, backoffMultiplier = 2, jitterPercent = 0 } = config

  // Calculate exponential delay
  let delay = baseDelayMs * Math.pow(backoffMultiplier, attemptNumber)

  // Cap at max delay
  delay = Math.min(delay, maxDelayMs)

  // Add jitter if configured
  if (jitterPercent > 0) {
    const jitterRange = delay * (jitterPercent / 100)
    const jitter = (Math.random() * 2 - 1) * jitterRange
    delay = delay + jitter
  }

  return Math.round(delay)
}

/**
 * Create initial retry state
 */
export function createRetryState(config: Partial<RetryConfig> = {}): RetryState {
  return {
    attemptNumber: 0,
    lastAttemptTime: null,
    nextRetryTime: null,
    exhausted: false,
  }
}

/**
 * Check if retry should occur
 */
export function shouldRetry(
  config: RetryConfig,
  state: RetryState,
  error?: ClassifiedError
): boolean {
  // Already exhausted
  if (state.exhausted) {
    return false
  }

  // Exceeded max retries
  if (state.attemptNumber >= config.maxRetries) {
    return false
  }

  // Check if error category is retryable
  if (error && config.retryableCategories) {
    if (!config.retryableCategories.includes(error.category)) {
      return false
    }
  }

  return true
}

/**
 * Select a fallback agent
 */
export function selectFallbackAgent(
  config: FallbackConfig,
  agents: AgentForFallback[]
): AgentForFallback | null {
  // Filter excluded agents
  let candidates = agents.filter((a) => !config.excludeAgentIds?.includes(a.id))

  if (candidates.length === 0) {
    return null
  }

  switch (config.strategy) {
    case 'capability-match':
      if (config.requiredSkills && config.requiredSkills.length > 0) {
        candidates = candidates.filter((a) => {
          const agentSkills = a.skills ?? []
          return config.requiredSkills!.every((skill) => agentSkills.includes(skill))
        })
      }
      return candidates[0] ?? null

    case 'least-loaded':
      candidates.sort((a, b) => {
        const loadA = (a.currentLoad ?? 0) / (a.maxLoad ?? 1)
        const loadB = (b.currentLoad ?? 0) / (b.maxLoad ?? 1)
        return loadA - loadB
      })
      return candidates[0] ?? null

    case 'same-tier':
      if (config.currentTier) {
        candidates = candidates.filter((a) => a.tier === config.currentTier)
      }
      return candidates[0] ?? null

    case 'round-robin':
    default:
      return candidates[0] ?? null
  }
}

/**
 * Get degradation level based on severity and options
 */
export function getDegradationLevel(
  severity: ErrorSeverity,
  options: DegradationOptions = {}
): DegradationLevel {
  // Check custom rules first
  if (options.rules) {
    for (const rule of options.rules) {
      if (rule.condition(severity)) {
        return rule.level
      }
    }
  }

  // Check error count threshold
  if (options.errorCount !== undefined && options.threshold !== undefined) {
    if (options.errorCount >= options.threshold) {
      // Bump up degradation level
      switch (severity) {
        case 'low':
          return 'partial'
        case 'medium':
          return 'significant'
        case 'high':
        case 'critical':
          return 'full'
      }
    }
  }

  // Default based on severity
  switch (severity) {
    case 'low':
      return 'none'
    case 'medium':
      return 'partial'
    case 'high':
      return 'significant'
    case 'critical':
      return 'full'
    default:
      return 'none'
  }
}

/**
 * Create initial recovery state
 */
export function createRecoveryState(options: RecoveryStateOptions): RecoveryState {
  return {
    errorId: options.errorId,
    tier: options.tier,
    ...(options.agentId !== undefined && { agentId: options.agentId }),
    retryState: createRetryState(),
    escalated: false,
    resolved: false,
    escalationPath: [options.tier],
    fallbackHistory: options.agentId ? [options.agentId] : [],
  }
}

/**
 * Update recovery state
 */
export function updateRecoveryState(
  state: RecoveryState,
  update: RecoveryStateUpdate
): RecoveryState {
  switch (update.type) {
    case 'retry':
      return {
        ...state,
        retryState: {
          ...state.retryState,
          attemptNumber: state.retryState.attemptNumber + 1,
          lastAttemptTime: new Date(),
          exhausted: update.exhausted ?? state.retryState.exhausted,
        },
        lastAction: 'retry',
      }

    case 'escalate':
      const newTier = update.toTier ?? state.tier
      return {
        ...state,
        tier: newTier,
        escalated: true,
        escalationPath: [...state.escalationPath, newTier],
        lastAction: 'escalate',
        ...(update.isTerminal !== undefined && { isTerminal: update.isTerminal }),
      }

    case 'fallback':
      const oldAgentId = state.agentId
      return {
        ...state,
        ...(update.toAgentId !== undefined && { agentId: update.toAgentId }),
        fallbackHistory: oldAgentId
          ? [...state.fallbackHistory, oldAgentId]
          : state.fallbackHistory,
        lastAction: 'fallback',
      }

    case 'resolve':
      return {
        ...state,
        resolved: true,
        ...(update.resolution !== undefined && { resolution: update.resolution }),
        lastAction: 'resolve',
      }

    default:
      return state
  }
}

/**
 * Check if error is recoverable
 */
export function isRecoverable(state: RecoveryState): boolean {
  // If resolved, not recoverable (already done)
  if (state.resolved) {
    return false
  }

  // If retries not exhausted, recoverable
  if (!state.retryState.exhausted) {
    return true
  }

  // If at terminal tier and retries exhausted, not recoverable
  if (state.isTerminal && state.retryState.exhausted) {
    return false
  }

  // If not at human tier, can still escalate
  if (state.tier !== 'human') {
    return true
  }

  // At human tier with exhausted retries - not recoverable
  return false
}

// ============================================================================
// Escalation Engine Implementation
// ============================================================================

/**
 * Create an escalation engine
 */
export function createEscalationEngine(options: EscalationEngineOptions = {}): EscalationEngine {
  const policy = options.policy ?? createEscalationPolicy({})
  const retryConfig: RetryConfig = options.retryConfig ?? {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  }

  // Metrics tracking
  let metrics: EscalationMetrics = {
    totalErrors: 0,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    escalationsByTier: {},
    retrySuccessRate: 0,
    retriesTotal: 0,
    retriesSuccessful: 0,
  }

  async function handleError(error: Error, opts: HandleErrorOptions): Promise<EscalationResult> {
    // Classify the error
    const severity = opts.severity ?? getErrorSeverity(error)
    const category = getErrorCategory(error)

    const classifiedError = createClassifiedError(error, {
      severity,
      category,
      ...(opts.tier !== undefined && { tier: opts.tier }),
      ...(opts.agentId !== undefined && { agentId: opts.agentId }),
      ...(opts.taskId !== undefined && { taskId: opts.taskId }),
      ...(opts.previousError !== undefined && { previousError: opts.previousError }),
      ...(opts.context !== undefined && { context: opts.context }),
    })

    // Update metrics
    metrics.totalErrors++
    metrics.bySeverity[severity]++

    // Get retry state
    const retryState = opts.retryState ?? createRetryState()

    // Get tier-specific config
    const tierPolicy = policy.tierPolicies?.[opts.tier]
    const effectiveRetryConfig: RetryConfig = {
      ...retryConfig,
      maxRetries: tierPolicy?.maxRetries ?? retryConfig.maxRetries,
    }

    // Determine action
    let action: EscalationResult['action']
    let retryDelay: number | undefined
    let escalationPath: EscalationPath | undefined
    let fallbackAgent: AgentForFallback | undefined
    let degradationLevel: DegradationLevel | undefined

    // Check for simulated retry results
    if (opts.simulateRetrySuccess) {
      metrics.retriesTotal++
      metrics.retriesSuccessful++
      metrics.retrySuccessRate = metrics.retriesSuccessful / metrics.retriesTotal
    } else if (opts.simulateRetryFailure) {
      metrics.retriesTotal++
      metrics.retrySuccessRate = metrics.retriesSuccessful / metrics.retriesTotal
    }

    // Should we retry?
    if (!retryState.exhausted && shouldRetry(effectiveRetryConfig, retryState, classifiedError)) {
      action = 'retry'
      retryDelay = calculateBackoff(effectiveRetryConfig, retryState.attemptNumber)
      metrics.retriesTotal++
    }
    // Should we escalate?
    else if (opts.tier !== 'human') {
      // Check escalation history depth
      const history = opts.escalationHistory ?? [opts.tier]
      const path = determineEscalationPath(classifiedError, policy)
      const validation = validateEscalationPath(path, history, policy)

      if (validation.valid && !path.isTerminal) {
        action = 'escalate'
        escalationPath = path
        metrics.escalationsByTier[opts.tier] = (metrics.escalationsByTier[opts.tier] ?? 0) + 1
      } else if (opts.availableAgents && opts.availableAgents.length > 0) {
        // Try fallback
        action = 'fallback'
        fallbackAgent =
          selectFallbackAgent(
            { strategy: 'capability-match', excludeAgentIds: [opts.agentId ?? ''] },
            opts.availableAgents
          ) ?? undefined
      } else {
        action = 'degrade'
        degradationLevel = getDegradationLevel(severity)
      }
    }
    // At human tier - try fallback or degrade
    else {
      if (opts.availableAgents && opts.availableAgents.length > 0) {
        action = 'fallback'
        fallbackAgent =
          selectFallbackAgent(
            { strategy: 'same-tier', currentTier: 'human', excludeAgentIds: [opts.agentId ?? ''] },
            opts.availableAgents
          ) ?? undefined
        if (!fallbackAgent) {
          action = 'terminal'
        }
      } else {
        action = 'terminal'
      }
    }

    return {
      handled: true,
      action,
      classifiedError,
      ...(retryDelay !== undefined && { retryDelay }),
      ...(escalationPath !== undefined && { escalationPath }),
      ...(fallbackAgent !== undefined && { fallbackAgent }),
      ...(degradationLevel !== undefined && { degradationLevel }),
      ...(opts.context !== undefined && { preservedContext: opts.context }),
      ...(opts.previousError !== undefined && { errorChain: buildErrorChain(classifiedError) }),
    }
  }

  function getMetrics(): EscalationMetrics {
    return { ...metrics }
  }

  function reset(): void {
    metrics = {
      totalErrors: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      escalationsByTier: {},
      retrySuccessRate: 0,
      retriesTotal: 0,
      retriesSuccessful: 0,
    }
  }

  return {
    handleError,
    getMetrics,
    reset,
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Error Classification
  getErrorSeverity,
  getErrorCategory,
  createClassifiedError,
  classifyError,
  isEscalatable,
  preserveContext,
  buildErrorChain,

  // Escalation Routing
  createEscalationPolicy,
  getNextEscalationTier,
  determineEscalationPath,
  shouldEscalate,
  detectCircularEscalation,
  validateEscalationPath,

  // Recovery Patterns
  calculateBackoff,
  createRetryState,
  shouldRetry,
  selectFallbackAgent,
  getDegradationLevel,
  createRecoveryState,
  updateRecoveryState,
  isRecoverable,

  // Escalation Engine
  createEscalationEngine,
}
