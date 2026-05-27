/**
 * Decision-making functionality for digital workers
 *
 * IMPORTANT: Worker-Assisted Decisions vs LLM Judging
 * ----------------------------------------------------
 * This module provides structured decision-making that can involve human
 * decision-makers, NOT simple LLM-based option selection.
 *
 * - `digital-workers.decide()` - Structured decision-making with criteria
 *   evaluation, confidence scoring, and optional human approval routing.
 *
 * - `ai-functions.decide()` - LLM as judge - compares options and picks
 *   the best one based on criteria (curried function pattern).
 *
 * Use digital-workers when you need:
 * - Multi-criteria decision analysis
 * - Confidence scores and alternative rankings
 * - Human approval for critical decisions
 * - Audit trail of decision reasoning
 *
 * Use ai-functions when you need:
 * - Simple "pick the best" comparison
 * - LLM judging between options
 * - Curried decision function pattern
 *
 * @module
 */

import { generateObject } from 'ai-functions'
import type { Decision, DecideOptions, Worker, ActionTarget, RoleTarget } from './types.js'

/**
 * A target for `decide` — concrete `ActionTarget` or `RoleTarget`.
 *
 * The legacy 1-arg form `decide(options)` keeps its LLM-direct behaviour. The
 * 2-arg form `decide(target, options)` routes through the resolved Worker's
 * `dispatch.decide` port. PRD: aip-2q19.
 */
export type DecideTarget = ActionTarget | RoleTarget

/**
 * Make a structured decision with criteria evaluation and optional human routing.
 *
 * **Key Difference from ai-functions.decide():**
 * Unlike `ai-functions.decide()` which is a curried LLM judge function
 * (e.g., `decide\`criteria\`(optionA, optionB)`), this function provides
 * comprehensive decision analysis with:
 * - Multi-criteria scoring
 * - Confidence levels
 * - Alternative rankings
 * - Optional human approval routing via `decide.withApproval()`
 *
 * This is a **decision framework**, not a simple LLM comparison primitive.
 *
 * @param options - Decision options including choices, context, and criteria
 * @returns Promise resolving to decision with choice, reasoning, confidence, and alternatives
 *
 * @example
 * ```ts
 * // Structured decision with criteria evaluation
 * const decision = await decide({
 *   options: ['Option A', 'Option B', 'Option C'],
 *   context: 'We need to choose a technology stack for our new project',
 *   criteria: [
 *     'Developer experience',
 *     'Performance',
 *     'Community support',
 *     'Long-term viability',
 *   ],
 * })
 *
 * console.log(`Decision: ${decision.choice}`)
 * console.log(`Reasoning: ${decision.reasoning}`)
 * console.log(`Confidence: ${decision.confidence}`) // 0-1 score
 * console.log(`Alternatives:`, decision.alternatives)
 * ```
 *
 * @example
 * ```ts
 * // Complex decision with structured options
 * const decision = await decide({
 *   options: [
 *     { id: 'migrate', label: 'Migrate to new platform' },
 *     { id: 'refactor', label: 'Refactor existing system' },
 *     { id: 'rebuild', label: 'Rebuild from scratch' },
 *   ],
 *   context: {
 *     budget: '$500k',
 *     timeline: '6 months',
 *     teamSize: 5,
 *     currentSystem: 'Legacy monolith',
 *   },
 *   criteria: ['Cost', 'Time to market', 'Risk', 'Scalability'],
 * })
 * ```
 *
 * @see {@link ai-functions#decide} for LLM-as-judge option comparison
 */
export async function decide<T = string>(options: DecideOptions<T>): Promise<Decision<T>>
export async function decide<T = string>(
  target: DecideTarget,
  options: DecideOptions<T>
): Promise<Decision<T>>
export async function decide<T = string>(
  targetOrOptions: DecideTarget | DecideOptions<T>,
  maybeOptions?: DecideOptions<T>
): Promise<Decision<T>> {
  // Normalize overloads — sniff target vs options.
  let target: DecideTarget | undefined
  let opts: DecideOptions<T>
  if (maybeOptions !== undefined) {
    target = targetOrOptions as DecideTarget
    opts = maybeOptions
  } else {
    target = undefined
    opts = targetOrOptions as DecideOptions<T>
  }

  // If a target is supplied, try its `decide` dispatcher first.
  if (target !== undefined) {
    const resolved = await resolveRoleTarget(target)
    const dispatcher = getDispatcher(resolved)
    if (dispatcher && dispatcher.decide) {
      const out = await dispatcher.decide<T>({
        options: opts.options,
        ...(opts.context !== undefined && { context: opts.context }),
      })
      // NOTE: the dispatcher contract (WorkerDecideOutput) currently surfaces
      // only `decision`. `reasoning`/`confidence`/`alternatives` are placeholder
      // values; callers that depend on those fields should NOT route through a
      // dispatcher today. Widening WorkerDecideOutput to carry them is a future
      // enhancement (would require dispatchers to surface them too).
      return {
        choice: out.decision,
        reasoning: '',
        confidence: 1,
        alternatives: [],
      }
    }
    // No dispatcher available — fall through to the legacy LLM path.
  }

  const { options: choices, context, criteria = [], includeReasoning = true } = opts

  // Format context for the prompt
  const contextStr =
    typeof context === 'string'
      ? context
      : context
      ? JSON.stringify(context, null, 2)
      : 'No additional context provided'

  // Format choices for the prompt
  const choicesStr = choices
    .map((choice, i) => {
      if (typeof choice === 'object' && choice !== null) {
        return `${i + 1}. ${JSON.stringify(choice)}`
      }
      return `${i + 1}. ${choice}`
    })
    .join('\n')

  const result = await generateObject({
    model: 'sonnet',
    schema: {
      choice: 'The chosen option (must be one of the provided options)',
      reasoning: includeReasoning
        ? 'Detailed reasoning explaining why this choice is best'
        : 'Brief explanation of the choice',
      confidence: 'Confidence level in this decision as a decimal (number)',
      alternatives: [
        {
          option: 'An alternative option that was considered',
          score: 'Score for this alternative from 0-100 (number)',
        },
      ],
      criteriaScores:
        criteria.length > 0
          ? 'Scores for each criterion as object mapping criterion name to score (0-100)'
          : undefined,
    },
    system: `You are a decision-making expert. Analyze the options carefully and make the best choice based on the context and criteria provided.

${
  criteria.length > 0
    ? `Evaluation Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''
}`,
    prompt: `Make a decision based on the following:

Context:
${contextStr}

Options:
${choicesStr}

${
  criteria.length > 0
    ? `\nEvaluate each option against these criteria:\n${criteria.join(', ')}`
    : ''
}

Provide your decision with clear reasoning.`,
  })

  const response = result.object as unknown as {
    choice: T
    reasoning: string
    confidence: number
    alternatives: Array<{ option: T; score: number }>
    criteriaScores?: Record<string, number>
  }

  return {
    choice: response.choice,
    reasoning: response.reasoning,
    confidence: Math.min(1, Math.max(0, response.confidence)),
    alternatives: response.alternatives,
  }
}

/**
 * Make a binary (yes/no) decision
 *
 * @param question - The yes/no question
 * @param context - Context for the decision
 * @returns Promise resolving to decision
 *
 * @example
 * ```ts
 * const decision = await decide.yesNo(
 *   'Should we proceed with the deployment?',
 *   {
 *     tests: 'All passing',
 *     codeReview: 'Approved',
 *     loadTests: 'Within acceptable range',
 *   }
 * )
 *
 * if (decision.choice === 'yes') {
 *   // Proceed with deployment
 * }
 * ```
 */
decide.yesNo = async (
  question: string,
  context?: string | Record<string, unknown>
): Promise<Decision<'yes' | 'no'>> => {
  return decide({
    options: ['yes', 'no'] as const,
    context:
      typeof context === 'string'
        ? `${question}\n\n${context}`
        : `${question}\n\n${context ? JSON.stringify(context, null, 2) : ''}`,
  })
}

/**
 * Make a prioritization decision
 *
 * Ranks options by priority instead of choosing one.
 *
 * @param items - Items to prioritize
 * @param context - Context for prioritization
 * @param criteria - Criteria for prioritization
 * @returns Promise resolving to prioritized list
 *
 * @example
 * ```ts
 * const prioritized = await decide.prioritize(
 *   ['Feature A', 'Bug fix B', 'Tech debt C', 'Feature D'],
 *   'Sprint planning for next 2 weeks',
 *   ['User impact', 'Urgency', 'Effort required']
 * )
 *
 * console.log('Priority order:', prioritized.map(p => p.choice))
 * ```
 */
decide.prioritize = async <T = string>(
  items: T[],
  context?: string | Record<string, unknown>,
  criteria: string[] = []
): Promise<Array<Decision<T> & { rank: number }>> => {
  const contextStr =
    typeof context === 'string'
      ? context
      : context
      ? JSON.stringify(context, null, 2)
      : 'No additional context provided'

  const itemsStr = items
    .map((item, i) => `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`)
    .join('\n')

  const result = await generateObject({
    model: 'sonnet',
    schema: {
      prioritized: [
        {
          item: 'The item',
          rank: 'Priority rank (1 = highest) (number)',
          reasoning: 'Why this priority',
          confidence: 'Confidence in this ranking (number)',
        },
      ],
    },
    system: `You are a prioritization expert. Rank items by priority based on the context and criteria.

${
  criteria.length > 0
    ? `Prioritization Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''
}`,
    prompt: `Prioritize the following items:

Context:
${contextStr}

Items:
${itemsStr}

${criteria.length > 0 ? `\nConsider these criteria when prioritizing:\n${criteria.join(', ')}` : ''}

Rank all items from highest to lowest priority.`,
  })

  const response = result.object as unknown as {
    prioritized: Array<{
      item: T
      rank: number
      reasoning: string
      confidence: number
    }>
  }

  return response.prioritized.map((p) => ({
    choice: p.item,
    rank: p.rank,
    reasoning: p.reasoning,
    confidence: Math.min(1, Math.max(0, p.confidence)),
  }))
}

/**
 * Make a decision with approval required
 *
 * Makes a recommendation but requires human approval before finalizing.
 *
 * @param options - Decision options
 * @param approver - Who should approve the decision
 * @returns Promise resolving to approved decision
 *
 * @example
 * ```ts
 * const decision = await decide.withApproval(
 *   {
 *     options: ['Rollback', 'Fix forward', 'Wait'],
 *     context: 'Production incident - 500 errors on checkout',
 *     criteria: ['User impact', 'Recovery time', 'Risk'],
 *   },
 *   'oncall-engineer@company.com'
 * )
 * ```
 */
decide.withApproval = async <T = string>(
  options: DecideOptions<T>,
  approver: string
): Promise<Decision<T> & { approved: boolean; approvedBy?: string }> => {
  // First, make the decision
  const decision = await decide(options)

  // Then request approval
  const { approve } = await import('./approve.js')
  const approval = await approve(
    `Approve decision: ${decision.choice}`,
    { id: approver },
    {
      via: 'slack',
      context: {
        decision,
        options: options.options,
        context: options.context,
      },
    }
  )

  const approvedBy = approval.approvedBy?.id ?? approval.approvedBy?.name
  return {
    ...decision,
    approved: approval.approved,
    ...(approvedBy !== undefined && { approvedBy }),
  }
}

// ============================================================================
// Internal Helpers — Worker dispatch (PRD aip-2q19)
// ============================================================================

function isRoleTarget(target: DecideTarget): target is RoleTarget {
  return (
    typeof target === 'object' &&
    target !== null &&
    (target as { $type?: unknown }).$type === 'Role' &&
    typeof (target as RoleTarget).resolveWorker === 'function'
  )
}

async function resolveRoleTarget(target: DecideTarget): Promise<ActionTarget> {
  if (isRoleTarget(target)) {
    return target.resolveWorker()
  }
  return target as ActionTarget
}

function getDispatcher(target: ActionTarget) {
  if (typeof target === 'object' && target !== null && 'dispatch' in target) {
    return (target as Worker).dispatch
  }
  return undefined
}
