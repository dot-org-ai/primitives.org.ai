/**
 * AI Expense Analyzer
 *
 * Uses ai-functions to analyze expenses and determine if they require
 * human review. The analyzer produces structured output including:
 * - Risk assessment
 * - Suspicious pattern detection
 * - Recommended action (auto-approve, human-review, auto-reject)
 *
 * @example
 * ```ts
 * import { analyzeExpense, createExpenseAnalyzer } from './analyzer'
 *
 * // Simple usage
 * const analysis = await analyzeExpense(expense)
 *
 * // With custom policy
 * const analyzer = createExpenseAnalyzer({
 *   autoApproveMaxCents: 10000, // $100
 * })
 * const analysis = await analyzer.analyze(expense)
 * ```
 *
 * @packageDocumentation
 */

import type {
  ExpenseSubmission,
  ExpenseAnalysis,
  ExpensePolicy,
  RiskLevel,
  SuggestedAction,
} from './types.js'
import { DEFAULT_EXPENSE_POLICY } from './types.js'

// =============================================================================
// Expense Analysis Logic
// =============================================================================

/**
 * Suspicious patterns to detect in expenses
 */
interface SuspiciousPattern {
  /** Pattern ID */
  id: string
  /** Pattern description */
  description: string
  /** Check if pattern matches */
  check: (expense: ExpenseSubmission) => boolean
  /** Risk score contribution */
  riskContribution: number
}

/**
 * Built-in suspicious patterns
 */
const SUSPICIOUS_PATTERNS: SuspiciousPattern[] = [
  {
    id: 'missing_receipt',
    description: 'Missing receipt for expense over $25',
    check: (exp) => !exp.receipt && exp.amountCents > 2500,
    riskContribution: 20,
  },
  {
    id: 'missing_vendor',
    description: 'Missing vendor information',
    check: (exp) => !exp.vendor,
    riskContribution: 15,
  },
  {
    id: 'round_amount',
    description: 'Suspiciously round amount (ends in 00)',
    check: (exp) => exp.amountCents > 10000 && exp.amountCents % 10000 === 0,
    riskContribution: 10,
  },
  {
    id: 'just_under_threshold',
    description: 'Amount just under common reporting thresholds',
    check: (exp) => {
      // Just under $100, $500, $1000, $5000, $10000
      const thresholds = [10000, 50000, 100000, 500000, 1000000]
      return thresholds.some((t) => exp.amountCents >= t - 500 && exp.amountCents < t)
    },
    riskContribution: 25,
  },
  {
    id: 'vague_description',
    description: 'Vague or minimal description',
    check: (exp) => exp.description.length < 10,
    riskContribution: 10,
  },
  {
    id: 'weekend_expense',
    description: 'Expense submitted on weekend',
    check: (exp) => {
      const day = exp.submittedAt.getDay()
      return day === 0 || day === 6
    },
    riskContribution: 5,
  },
  {
    id: 'high_value',
    description: 'High-value expense over $5,000',
    check: (exp) => exp.amountCents > 500000,
    riskContribution: 30,
  },
  {
    id: 'no_project',
    description: 'No project or cost center assigned',
    check: (exp) => !exp.project,
    riskContribution: 5,
  },
]

/**
 * Calculate risk score based on matched patterns
 */
function calculateRiskScore(
  expense: ExpenseSubmission,
  patterns: SuspiciousPattern[]
): { score: number; flags: string[] } {
  let score = 0
  const flags: string[] = []

  for (const pattern of patterns) {
    if (pattern.check(expense)) {
      score += pattern.riskContribution
      flags.push(pattern.description)
    }
  }

  // Cap at 100
  return { score: Math.min(100, score), flags }
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'low'
  if (score < 70) return 'medium'
  return 'high'
}

/**
 * Determine suggested action based on analysis
 */
function getSuggestedAction(
  expense: ExpenseSubmission,
  riskScore: number,
  policy: ExpensePolicy
): { action: SuggestedAction; reason: string } {
  // Auto-reject if extremely high risk
  if (riskScore >= 90) {
    return {
      action: 'auto_reject',
      reason: 'Extremely high risk score indicates potential fraud or policy violation',
    }
  }

  // Always review certain categories
  if (policy.alwaysReviewCategories.includes(expense.category)) {
    return {
      action: 'human_review',
      reason: `Category '${expense.category}' requires human review per policy`,
    }
  }

  // Human review for high-value expenses
  if (expense.amountCents >= policy.humanReviewMinCents) {
    return {
      action: 'human_review',
      reason: `Expense exceeds $${(policy.humanReviewMinCents / 100).toFixed(2)} threshold`,
    }
  }

  // Auto-approve low-risk, low-value expenses
  if (
    expense.amountCents <= policy.autoApproveMaxCents &&
    riskScore <= policy.maxAutoApproveRiskScore
  ) {
    return {
      action: 'auto_approve',
      reason: `Low-value expense ($${(expense.amountCents / 100).toFixed(
        2
      )}) with low risk score (${riskScore})`,
    }
  }

  // Default to human review
  return {
    action: 'human_review',
    reason: `Risk score (${riskScore}) or amount ($${(expense.amountCents / 100).toFixed(
      2
    )}) requires review`,
  }
}

// =============================================================================
// Expense Analyzer Class
// =============================================================================

/**
 * Expense Analyzer options
 */
export interface ExpenseAnalyzerOptions {
  /** Custom expense policy */
  policy?: Partial<ExpensePolicy>
  /** Custom patterns to check */
  customPatterns?: SuspiciousPattern[]
  /** Whether to use AI for enhanced analysis (future feature) */
  useAI?: boolean
}

/**
 * Expense Analyzer
 *
 * Analyzes expenses to determine risk level and whether human review
 * is required. Uses pattern matching and policy rules.
 *
 * @example
 * ```ts
 * const analyzer = new ExpenseAnalyzer({
 *   policy: { autoApproveMaxCents: 10000 },
 * })
 *
 * const analysis = await analyzer.analyze(expense)
 * if (analysis.requiresHumanReview) {
 *   // Route to approver
 * }
 * ```
 */
export class ExpenseAnalyzer {
  private policy: ExpensePolicy
  private patterns: SuspiciousPattern[]

  constructor(options: ExpenseAnalyzerOptions = {}) {
    // Merge with default policy
    this.policy = {
      ...DEFAULT_EXPENSE_POLICY,
      ...options.policy,
    }

    // Combine built-in and custom patterns
    this.patterns = [...SUSPICIOUS_PATTERNS, ...(options.customPatterns || [])]
  }

  /**
   * Analyze an expense submission
   *
   * @param expense - The expense to analyze
   * @returns Analysis result with risk assessment and recommendation
   */
  async analyze(expense: ExpenseSubmission): Promise<ExpenseAnalysis> {
    // Step 1: Calculate risk score and detect patterns
    const { score: riskScore, flags } = calculateRiskScore(expense, this.patterns)

    // Step 2: Determine risk level
    const riskLevel = getRiskLevel(riskScore)

    // Step 3: Determine suggested action
    const { action, reason } = getSuggestedAction(expense, riskScore, this.policy)

    // Step 4: Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(expense, flags)

    // Step 5: Build and return analysis result
    return {
      isValid: riskScore < 90, // Invalid if extremely high risk
      riskScore,
      riskLevel,
      flags,
      requiresHumanReview: action === 'human_review',
      suggestedAction: action,
      reason,
      confidence,
    }
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(expense: ExpenseSubmission, flags: string[]): number {
    let confidence = 1.0

    // Reduce confidence for missing data
    if (!expense.receipt) confidence -= 0.1
    if (!expense.vendor) confidence -= 0.1
    if (!expense.project) confidence -= 0.05
    if (expense.description.length < 20) confidence -= 0.05

    // Reduce confidence for many flags (more uncertainty)
    confidence -= flags.length * 0.05

    // Ensure within bounds
    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Get the current policy
   */
  getPolicy(): ExpensePolicy {
    return { ...this.policy }
  }

  /**
   * Update policy dynamically
   */
  updatePolicy(updates: Partial<ExpensePolicy>): void {
    this.policy = { ...this.policy, ...updates }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an expense analyzer with custom options
 *
 * @param options - Analyzer options
 * @returns Configured expense analyzer
 *
 * @example
 * ```ts
 * const analyzer = createExpenseAnalyzer({
 *   policy: {
 *     autoApproveMaxCents: 10000, // $100
 *     humanReviewMinCents: 100000, // $1000
 *   },
 * })
 * ```
 */
export function createExpenseAnalyzer(options: ExpenseAnalyzerOptions = {}): ExpenseAnalyzer {
  return new ExpenseAnalyzer(options)
}

/**
 * Analyze an expense using default settings
 *
 * Convenience function for quick analysis without creating an analyzer.
 *
 * @param expense - The expense to analyze
 * @returns Analysis result
 *
 * @example
 * ```ts
 * const analysis = await analyzeExpense(expense)
 * console.log(`Risk: ${analysis.riskLevel}, Action: ${analysis.suggestedAction}`)
 * ```
 */
export async function analyzeExpense(expense: ExpenseSubmission): Promise<ExpenseAnalysis> {
  const analyzer = createExpenseAnalyzer()
  return analyzer.analyze(expense)
}

// =============================================================================
// AI-Enhanced Analysis (Future Feature)
// =============================================================================

/**
 * Schema for AI-generated expense analysis
 *
 * This schema would be used with ai-functions to generate
 * more sophisticated analysis using LLMs.
 *
 * @example
 * ```ts
 * // Future implementation
 * import { generateObject } from 'ai-functions'
 *
 * const result = await generateObject({
 *   model: 'sonnet',
 *   schema: EXPENSE_ANALYSIS_SCHEMA,
 *   prompt: `Analyze this expense for fraud indicators: ${JSON.stringify(expense)}`,
 * })
 * ```
 */
export const EXPENSE_ANALYSIS_SCHEMA = {
  isValid: 'Is this expense valid and properly documented?',
  riskScore: 'Risk score from 0-100 (higher = more suspicious)',
  riskLevel: 'low | medium | high',
  flags: ['List any suspicious patterns or policy violations'],
  requiresHumanReview: 'Does this need human review?',
  suggestedAction: 'auto_approve | human_review | auto_reject',
  reason: 'Explain the recommendation',
  confidence: 'Confidence in analysis from 0-1',
}
