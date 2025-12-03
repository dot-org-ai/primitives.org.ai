/**
 * Decision-making functionality for digital workers
 */

import { generateObject } from 'ai-functions'
import type { Decision, DecideOptions } from './types.js'

/**
 * Make a decision from a set of options
 *
 * Uses AI to evaluate options and make a reasoned decision,
 * or can route to human decision-makers for critical choices.
 *
 * @param options - Decision options with configuration
 * @returns Promise resolving to decision result
 *
 * @example
 * ```ts
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
 * console.log(`Confidence: ${decision.confidence}`)
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
 */
export async function decide<T = string>(
  options: DecideOptions<T>
): Promise<Decision<T>> {
  const {
    options: choices,
    context,
    criteria = [],
    includeReasoning = true,
  } = options

  // Format context for the prompt
  const contextStr = typeof context === 'string'
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
      criteriaScores: criteria.length > 0
        ? 'Scores for each criterion as object mapping criterion name to score (0-100)'
        : undefined,
    },
    system: `You are a decision-making expert. Analyze the options carefully and make the best choice based on the context and criteria provided.

${criteria.length > 0 ? `Evaluation Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}`,
    prompt: `Make a decision based on the following:

Context:
${contextStr}

Options:
${choicesStr}

${criteria.length > 0 ? `\nEvaluate each option against these criteria:\n${criteria.join(', ')}` : ''}

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
    context: typeof context === 'string'
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
  const contextStr = typeof context === 'string'
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

${criteria.length > 0 ? `Prioritization Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}`,
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
    {
      channel: 'slack',
      approver,
      context: {
        decision,
        options: options.options,
        context: options.context,
      },
    }
  )

  return {
    ...decision,
    approved: approval.approved,
    approvedBy: approval.approvedBy,
  }
}
