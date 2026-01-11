/**
 * Fallback Resolution Patterns for Human Decisions
 *
 * This module provides primitives for:
 * - Decision logging with full context and audit trail
 * - Feedback loops for AI model improvement
 * - Fallback chains for human escalation
 * - Decision analytics and pattern detection
 */

import type { HumanStore, HumanRequest, Priority } from './types.js'

/**
 * Context for a decision
 */
export interface DecisionContext {
  /** The original request ID */
  requestId: string
  /** Type of request (approval, review, decision, etc.) */
  requestType: string
  /** AI's suggested decision (if any) */
  aiSuggestion?: string
  /** AI's confidence in its suggestion (0-1) */
  aiConfidence?: number
  /** Original input data for the decision */
  inputData: unknown
  /** Timestamp of the original request */
  timestamp: Date
}

/**
 * A logged decision with full context
 */
export interface DecisionLog {
  /** Unique decision ID */
  id: string
  /** Who made the decision */
  decisionMaker: string
  /** The decision made */
  decision: string
  /** Context of the decision */
  context: DecisionContext
  /** Human reasoning for the decision */
  reasoning?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** When the decision was made */
  timestamp: Date
  /** Version number for tracking updates */
  version: number
  /** Previous versions of this decision */
  previousVersions?: Array<{ decision: string; reasoning?: string; timestamp: Date }>
  /** Whether this decision overrides AI suggestion */
  isOverride: boolean
  /** Override details if applicable */
  overrideDetails?: {
    aiRecommendation: string
    humanDecision: string
    aiConfidence: number
  }
}

/**
 * Input for logging a decision
 */
export interface LogDecisionInput {
  decisionMaker: string
  decision: string
  context: DecisionContext
  reasoning?: string
  metadata?: Record<string, unknown>
}

/**
 * Compliance report filters
 */
export interface ComplianceReportFilters {
  overridesOnly?: boolean
  decisionMaker?: string
  startDate?: Date
  endDate?: Date
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  totalDecisions: number
  overrides: number
  overrideRate: number
  overrideDecisions: DecisionLog[]
}

/**
 * Decision Logger for audit trail
 */
export class DecisionLogger {
  private decisions = new Map<string, DecisionLog>()
  private decisionsByRequest = new Map<string, string[]>()
  private idCounter = 0

  /**
   * Generate a unique decision ID
   */
  private generateId(): string {
    return `dec_${Date.now()}_${++this.idCounter}`
  }

  /**
   * Check if decision is an override of AI suggestion
   */
  private isOverrideDecision(decision: string, context: DecisionContext): boolean {
    if (!context.aiSuggestion) return false

    // Normalize decisions for comparison
    const normalizedDecision = this.normalizeDecision(decision)
    const normalizedAiSuggestion = this.normalizeDecision(context.aiSuggestion)

    return normalizedDecision !== normalizedAiSuggestion
  }

  /**
   * Normalize decision string for comparison
   */
  private normalizeDecision(decision: string): string {
    const normalized = decision.toLowerCase().trim()
    // Map common synonyms
    if (normalized === 'approved' || normalized === 'approve') return 'approve'
    if (normalized === 'rejected' || normalized === 'reject') return 'reject'
    return normalized
  }

  /**
   * Log a human decision with full context
   */
  logDecision(input: LogDecisionInput): DecisionLog {
    const id = this.generateId()
    const isOverride = this.isOverrideDecision(input.decision, input.context)

    const log: DecisionLog = {
      id,
      decisionMaker: input.decisionMaker,
      decision: input.decision,
      context: input.context,
      reasoning: input.reasoning,
      metadata: input.metadata,
      timestamp: new Date(),
      version: 1,
      isOverride,
      overrideDetails: isOverride && input.context.aiSuggestion && input.context.aiConfidence
        ? {
            aiRecommendation: input.context.aiSuggestion,
            humanDecision: input.decision,
            aiConfidence: input.context.aiConfidence,
          }
        : undefined,
    }

    this.decisions.set(id, log)

    // Index by request ID
    const requestLogs = this.decisionsByRequest.get(input.context.requestId) || []
    requestLogs.push(id)
    this.decisionsByRequest.set(input.context.requestId, requestLogs)

    return log
  }

  /**
   * Update an existing decision (creates new version)
   */
  updateDecision(
    id: string,
    updates: { decision: string; reasoning?: string }
  ): DecisionLog {
    const existing = this.decisions.get(id)
    if (!existing) {
      throw new Error(`Decision not found: ${id}`)
    }

    const previousVersion = {
      decision: existing.decision,
      reasoning: existing.reasoning,
      timestamp: existing.timestamp,
    }

    const updated: DecisionLog = {
      ...existing,
      decision: updates.decision,
      reasoning: updates.reasoning || existing.reasoning,
      timestamp: new Date(),
      version: existing.version + 1,
      previousVersions: [...(existing.previousVersions || []), previousVersion],
      isOverride: this.isOverrideDecision(updates.decision, existing.context),
    }

    this.decisions.set(id, updated)
    return updated
  }

  /**
   * Get decision history for a request
   */
  getDecisionHistory(requestId: string): DecisionLog[] {
    const logIds = this.decisionsByRequest.get(requestId) || []
    return logIds
      .map((id) => this.decisions.get(id))
      .filter((log): log is DecisionLog => log !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Query decisions by date range
   */
  queryByDateRange(startDate: Date, endDate: Date): DecisionLog[] {
    return Array.from(this.decisions.values()).filter(
      (log) =>
        log.context.timestamp >= startDate && log.context.timestamp <= endDate
    )
  }

  /**
   * Get compliance report
   */
  getComplianceReport(filters: ComplianceReportFilters = {}): ComplianceReport {
    let decisions = Array.from(this.decisions.values())

    if (filters.decisionMaker) {
      decisions = decisions.filter(
        (d) => d.decisionMaker === filters.decisionMaker
      )
    }

    if (filters.startDate) {
      decisions = decisions.filter(
        (d) => d.context.timestamp >= filters.startDate!
      )
    }

    if (filters.endDate) {
      decisions = decisions.filter(
        (d) => d.context.timestamp <= filters.endDate!
      )
    }

    const overrideDecisions = decisions.filter((d) => d.isOverride)

    return {
      totalDecisions: decisions.length,
      overrides: overrideDecisions.length,
      overrideRate:
        decisions.length > 0 ? overrideDecisions.length / decisions.length : 0,
      overrideDecisions,
    }
  }

  /**
   * Get all decisions (for analytics)
   */
  getAllDecisions(): DecisionLog[] {
    return Array.from(this.decisions.values())
  }

  /**
   * Get decision by ID
   */
  getDecision(id: string): DecisionLog | undefined {
    return this.decisions.get(id)
  }

  /**
   * Clear all decisions (for testing)
   */
  clear(): void {
    this.decisions.clear()
    this.decisionsByRequest.clear()
    this.idCounter = 0
  }
}

/**
 * Feedback signal for AI model improvement
 */
export interface FeedbackSignal {
  /** Unique signal ID */
  id: string
  /** Type of signal */
  type: 'reinforcement' | 'correction'
  /** The correct label from human decision */
  label: string
  /** Weight of this signal for training */
  weight: number
  /** Training data */
  trainingData: {
    input: unknown
    output?: unknown
    correction?: string
  }
  /** When the signal was generated */
  timestamp: Date
}

/**
 * Input for generating a feedback signal
 */
export interface GenerateSignalInput {
  decisionId: string
  requestId: string
  inputData: unknown
  aiPrediction: string
  aiConfidence?: number
  humanDecision: string
  outcome: 'correct' | 'override' | 'unknown'
  reasoning?: string
}

/**
 * Training batch
 */
export interface TrainingBatch {
  signals: FeedbackSignal[]
  stats: {
    totalSignals: number
    corrections: number
    reinforcements: number
  }
}

/**
 * Accuracy metrics
 */
export interface AccuracyMetrics {
  overallAccuracy: number
  totalDecisions: number
  correctPredictions: number
}

/**
 * Feedback Loop for AI model improvement
 */
export class FeedbackLoop {
  private signals: FeedbackSignal[] = []
  private idCounter = 0

  /**
   * Generate a unique signal ID
   */
  private generateId(): string {
    return `sig_${Date.now()}_${++this.idCounter}`
  }

  /**
   * Generate a training signal from a human decision
   */
  generateSignal(input: GenerateSignalInput): FeedbackSignal {
    const isCorrection = input.outcome === 'override'

    const signal: FeedbackSignal = {
      id: this.generateId(),
      type: isCorrection ? 'correction' : 'reinforcement',
      label: input.humanDecision,
      weight: isCorrection ? 2.0 : 1.0, // Corrections have higher weight
      trainingData: {
        input: input.inputData,
        correction: input.reasoning,
      },
      timestamp: new Date(),
    }

    this.signals.push(signal)
    return signal
  }

  /**
   * Get training batch
   */
  getTrainingBatch(options: { minSize?: number } = {}): TrainingBatch {
    const minSize = options.minSize || 1

    if (this.signals.length < minSize) {
      return {
        signals: [],
        stats: { totalSignals: 0, corrections: 0, reinforcements: 0 },
      }
    }

    const corrections = this.signals.filter((s) => s.type === 'correction')
    const reinforcements = this.signals.filter(
      (s) => s.type === 'reinforcement'
    )

    return {
      signals: [...this.signals],
      stats: {
        totalSignals: this.signals.length,
        corrections: corrections.length,
        reinforcements: reinforcements.length,
      },
    }
  }

  /**
   * Export signals in standard ML format
   */
  exportForTraining(format: 'jsonl' | 'json' = 'jsonl'): string {
    if (format === 'jsonl') {
      return this.signals
        .map((s) =>
          JSON.stringify({
            input: s.trainingData.input,
            label: s.label,
            weight: s.weight,
          })
        )
        .join('\n')
    }

    return JSON.stringify(
      this.signals.map((s) => ({
        input: s.trainingData.input,
        label: s.label,
        weight: s.weight,
      }))
    )
  }

  /**
   * Get accuracy metrics
   */
  getAccuracyMetrics(): AccuracyMetrics {
    const total = this.signals.length
    const correct = this.signals.filter(
      (s) => s.type === 'reinforcement'
    ).length

    return {
      overallAccuracy: total > 0 ? correct / total : 0,
      totalDecisions: total,
      correctPredictions: correct,
    }
  }

  /**
   * Clear all signals (for testing)
   */
  clear(): void {
    this.signals = []
    this.idCounter = 0
  }
}

/**
 * Fallback handler definition
 */
export interface FallbackHandler {
  /** Handler ID */
  id: string
  /** Handler name */
  name?: string
  /** Who handles requests at this level */
  assignee: string
  /** Function to determine if handler can handle the context */
  canHandle: (context: Record<string, unknown>) => boolean
  /** Timeout in milliseconds before escalating */
  timeout: number
  /** Priority (lower = higher priority) */
  priority: number
}

/**
 * Escalation record
 */
export interface EscalationRecord {
  from: string
  to: string
  reason: string
  timestamp: Date
}

/**
 * Escalation audit
 */
export interface EscalationAudit {
  requestId: string
  escalations: EscalationRecord[]
  finalHandler?: string
  completed: boolean
}

/**
 * Execute with fallback result
 */
export interface ExecuteWithFallbackResult {
  handlerUsed: string
  escalated: boolean
  escalationPath: string[]
  response?: unknown
}

/**
 * Fallback Chain for human escalation
 */
export class FallbackChain {
  private handlers: FallbackHandler[] = []
  private store?: HumanStore
  private escalationAudits = new Map<string, EscalationAudit>()

  /**
   * Set the store for request management
   */
  setStore(store: HumanStore): void {
    this.store = store
  }

  /**
   * Add a handler to the chain
   */
  addHandler(handler: FallbackHandler): void {
    this.handlers.push(handler)
    // Sort by priority (lower = higher priority)
    this.handlers.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get all handlers
   */
  getHandlers(): FallbackHandler[] {
    return [...this.handlers]
  }

  /**
   * Find the appropriate handler for a context
   */
  findHandler(context: Record<string, unknown>): FallbackHandler | undefined {
    return this.handlers.find((h) => h.canHandle(context))
  }

  /**
   * Execute request with fallback chain
   */
  async executeWithFallback(options: {
    requestId: string
    context: Record<string, unknown>
    simulateTimeout?: boolean
    maxEscalations?: number
  }): Promise<ExecuteWithFallbackResult> {
    const { requestId, context, simulateTimeout, maxEscalations } = options
    // Default maxEscalations to allow escalating through all handlers
    const effectiveMaxEscalations = maxEscalations ?? this.handlers.length - 1

    const escalationPath: string[] = []
    let currentHandlerIndex = 0
    let escalationCount = 0

    // Initialize audit
    const audit: EscalationAudit = {
      requestId,
      escalations: [],
      completed: false,
    }
    this.escalationAudits.set(requestId, audit)

    while (currentHandlerIndex < this.handlers.length) {
      const handler = this.handlers[currentHandlerIndex]
      if (!handler) break

      escalationPath.push(handler.id)

      // Check if handler can handle
      if (!handler.canHandle(context)) {
        currentHandlerIndex++
        continue
      }

      // Simulate timeout for testing
      const hasNextHandler = currentHandlerIndex < this.handlers.length - 1
      const canEscalate = escalationCount < effectiveMaxEscalations

      if (simulateTimeout) {
        if (hasNextHandler && canEscalate) {
          // Handler times out, escalate to next handler
          const nextHandler = this.handlers[currentHandlerIndex + 1]
          if (nextHandler) {
            audit.escalations.push({
              from: handler.id,
              to: nextHandler.id,
              reason: 'timeout',
              timestamp: new Date(),
            })
            escalationCount++
          }
          currentHandlerIndex++
          continue
        } else if (!hasNextHandler && escalationCount === 0) {
          // Last handler times out AND we never escalated - complete failure
          // This means there was only one handler and it timed out
          break // Will throw "All fallback handlers exhausted"
        }
        // Else: we've escalated and this is the final handler, or hit maxEscalations
        // In both cases, this handler should succeed
      }

      // Handler succeeds (either not simulating timeout, or this is the final handler after maxEscalations)
      audit.finalHandler = handler.id
      audit.completed = true

      return {
        handlerUsed: handler.id,
        escalated: escalationPath.length > 1,
        escalationPath,
      }
    }

    // All handlers exhausted
    throw new Error('All fallback handlers exhausted')
  }

  /**
   * Get escalation audit for a request
   */
  getEscalationAudit(requestId: string): EscalationAudit {
    const audit = this.escalationAudits.get(requestId)
    if (!audit) {
      return {
        requestId,
        escalations: [],
        completed: false,
      }
    }
    return audit
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers = []
    this.escalationAudits.clear()
  }
}

/**
 * Decision pattern
 */
export interface DecisionPattern {
  type: string
  description: string
  confidence: number
  occurrences: number
  examples?: string[]
}

/**
 * Time-based patterns
 */
export interface TimePatterns {
  peakApprovalDay: string
  approvalsByDay: Record<string, number>
}

/**
 * Dashboard data
 */
export interface DashboardData {
  totalDecisions: number
  approvalRate: number
  overrideRate: number
  averageResponseTime: number
  topDecisionMakers: Array<{ name: string; count: number }>
}

/**
 * Decision Analytics for pattern detection
 */
export class DecisionAnalytics {
  constructor(private logger: DecisionLogger) {}

  /**
   * Detect decision patterns for a decision maker
   */
  detectPatterns(options: {
    decisionMaker?: string
    minOccurrences?: number
  }): DecisionPattern[] {
    const { decisionMaker, minOccurrences = 3 } = options
    const decisions = this.logger.getAllDecisions()

    let filteredDecisions = decisions
    if (decisionMaker) {
      filteredDecisions = decisions.filter(
        (d) => d.decisionMaker === decisionMaker
      )
    }

    const patterns: DecisionPattern[] = []

    // Detect consistent rejection pattern
    const rejections = filteredDecisions.filter(
      (d) =>
        d.decision.toLowerCase().includes('reject') ||
        d.decision.toLowerCase().includes('denied')
    )

    if (rejections.length >= minOccurrences) {
      patterns.push({
        type: 'consistent-rejection',
        description: 'Consistently rejects requests',
        confidence: rejections.length / filteredDecisions.length,
        occurrences: rejections.length,
        examples: rejections.slice(0, 3).map((d) => d.context.requestId),
      })
    }

    // Detect consistent approval pattern
    const approvals = filteredDecisions.filter(
      (d) =>
        d.decision.toLowerCase().includes('approv') ||
        d.decision.toLowerCase() === 'approved'
    )

    if (approvals.length >= minOccurrences) {
      patterns.push({
        type: 'consistent-approval',
        description: 'Consistently approves requests',
        confidence: approvals.length / filteredDecisions.length,
        occurrences: approvals.length,
        examples: approvals.slice(0, 3).map((d) => d.context.requestId),
      })
    }

    return patterns
  }

  /**
   * Detect time-based patterns
   */
  detectTimePatterns(decisionMaker: string): TimePatterns {
    const decisions = this.logger
      .getAllDecisions()
      .filter((d) => d.decisionMaker === decisionMaker)

    const approvalsByDay: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]

    for (const decision of decisions) {
      if (
        decision.decision.toLowerCase().includes('approv') ||
        decision.decision.toLowerCase() === 'approved'
      ) {
        // Use the context timestamp (when request was made) for time-based patterns
        const dayIndex = decision.context.timestamp.getDay()
        const day = dayNames[dayIndex]
        if (day !== undefined) {
          approvalsByDay[day] = (approvalsByDay[day] ?? 0) + 1
        }
      }
    }

    // Find peak day
    let peakDay = 'Monday'
    let maxApprovals = 0

    for (const [day, count] of Object.entries(approvalsByDay)) {
      if (count > maxApprovals) {
        maxApprovals = count
        peakDay = day
      }
    }

    return {
      peakApprovalDay: peakDay,
      approvalsByDay,
    }
  }

  /**
   * Get consistency score for a decision maker
   */
  getConsistencyScore(decisionMaker: string): number {
    const decisions = this.logger
      .getAllDecisions()
      .filter((d) => d.decisionMaker === decisionMaker)

    if (decisions.length === 0) return 0

    // Group by similar inputs and check if decisions are consistent
    const decisionCounts: Record<string, number> = {}

    for (const decision of decisions) {
      const normalized = decision.decision.toLowerCase().trim()
      decisionCounts[normalized] = (decisionCounts[normalized] || 0) + 1
    }

    // Consistency = max frequency / total
    const maxCount = Math.max(...Object.values(decisionCounts))
    return maxCount / decisions.length
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): DashboardData {
    const decisions = this.logger.getAllDecisions()

    const approvals = decisions.filter(
      (d) =>
        d.decision.toLowerCase().includes('approv') ||
        d.decision.toLowerCase() === 'approved'
    )

    const overrides = decisions.filter((d) => d.isOverride)

    // Calculate response times (simplified - using timestamp difference from context)
    const responseTimes = decisions.map(
      (d) => d.timestamp.getTime() - d.context.timestamp.getTime()
    )

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0

    // Get top decision makers
    const makerCounts: Record<string, number> = {}
    for (const decision of decisions) {
      makerCounts[decision.decisionMaker] =
        (makerCounts[decision.decisionMaker] || 0) + 1
    }

    const topDecisionMakers = Object.entries(makerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalDecisions: decisions.length,
      approvalRate: decisions.length > 0 ? approvals.length / decisions.length : 0,
      overrideRate: decisions.length > 0 ? overrides.length / decisions.length : 0,
      averageResponseTime: avgResponseTime,
      topDecisionMakers,
    }
  }

  /**
   * Export decision data for training
   */
  exportForTraining(options: {
    format?: 'jsonl' | 'json'
    includeContext?: boolean
  }): string {
    const { format = 'jsonl', includeContext = false } = options
    const decisions = this.logger.getAllDecisions()

    const exportData = decisions.map((d) => ({
      input: includeContext ? d.context.inputData : undefined,
      decision: d.decision,
      reasoning: d.reasoning,
    }))

    if (format === 'jsonl') {
      return exportData.map((d) => JSON.stringify(d)).join('\n')
    }

    return JSON.stringify(exportData)
  }
}
