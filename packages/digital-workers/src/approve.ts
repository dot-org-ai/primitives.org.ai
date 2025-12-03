/**
 * Approval request functionality for digital workers
 */

import { define } from 'ai-functions'
import type { ApprovalResult, ApprovalOptions } from './types.js'

/**
 * Request approval from a human or authorized agent
 *
 * Creates a human-in-the-loop approval request that can be routed
 * through various channels (Slack, email, web UI, etc.).
 *
 * @param request - What is being requested for approval
 * @param options - Approval options (channel, approver, timeout, etc.)
 * @returns Promise resolving to approval result
 *
 * @example
 * ```ts
 * // Request approval for an expense
 * const result = await approve('Expense: $500 for AWS services', {
 *   channel: 'slack',
 *   approver: 'manager@company.com',
 *   context: {
 *     amount: 500,
 *     category: 'Infrastructure',
 *     vendor: 'AWS',
 *   },
 * })
 *
 * if (result.approved) {
 *   console.log(`Approved by ${result.approvedBy}`)
 *   // Proceed with expense
 * }
 * ```
 *
 * @example
 * ```ts
 * // Request deployment approval
 * const result = await approve('Deploy v2.1.0 to production', {
 *   channel: 'web',
 *   approver: 'ops-team',
 *   context: {
 *     version: 'v2.1.0',
 *     environment: 'production',
 *     changes: ['New feature X', 'Bug fix Y', 'Performance improvements'],
 *   },
 * })
 * ```
 */
export async function approve(
  request: string,
  options: ApprovalOptions = {}
): Promise<ApprovalResult> {
  const {
    channel = 'web',
    approver,
    timeout,
    context,
  } = options

  // Use ai-functions to define a human function for approval
  const approvalFn = define.human({
    name: 'requestApproval',
    description: 'Request approval from a human',
    args: {
      request: 'What is being requested for approval',
      contextInfo: 'Additional context for the approval decision',
    },
    returnType: {
      approved: 'Whether the request was approved (boolean)',
      notes: 'Any notes or feedback from the approver',
    },
    channel,
    instructions: `Please review the following approval request and approve or reject it.

Request: ${request}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Make your decision based on company policies and best judgment.`,
    assignee: approver,
    timeout,
  })

  // Call the approval function
  const response = await approvalFn.call({
    request,
    contextInfo: context ? JSON.stringify(context) : '',
  }) as unknown

  const typedResponse = response as { approved: boolean; notes?: string; _pending?: boolean }

  // If the response is pending (waiting for human input)
  if (typedResponse._pending) {
    // In a real implementation, this would poll or wait for the response
    // For now, return a pending status
    return {
      approved: false,
      channel,
      notes: 'Approval pending - waiting for human response',
    }
  }

  return {
    approved: typedResponse.approved,
    approvedBy: approver,
    approvedAt: new Date(),
    notes: typedResponse.notes,
    channel,
  }
}

/**
 * Request approval with a structured decision context
 *
 * @param request - Approval request
 * @param decision - Decision context with pros, cons, risks, etc.
 * @param options - Approval options
 * @returns Promise resolving to approval result
 *
 * @example
 * ```ts
 * const result = await approve.withContext('Migrate to new database', {
 *   pros: ['Better performance', 'Lower cost', 'Managed service'],
 *   cons: ['Migration effort', 'Downtime required', 'Learning curve'],
 *   risks: ['Data loss', 'Service disruption'],
 *   mitigations: ['Backup strategy', 'Staged rollout', 'Rollback plan'],
 * }, {
 *   channel: 'slack',
 *   approver: 'cto@company.com',
 * })
 * ```
 */
approve.withContext = async (
  request: string,
  decision: {
    pros?: string[]
    cons?: string[]
    risks?: string[]
    mitigations?: string[]
    alternatives?: string[]
  },
  options: ApprovalOptions = {}
): Promise<ApprovalResult> => {
  return approve(request, {
    ...options,
    context: {
      ...options.context,
      decision,
    },
  })
}

/**
 * Request batch approval for multiple items
 *
 * @param requests - Array of approval requests
 * @param options - Approval options
 * @returns Promise resolving to array of approval results
 *
 * @example
 * ```ts
 * const results = await approve.batch([
 *   'Expense: $500 for AWS',
 *   'Expense: $200 for office supplies',
 *   'Expense: $1000 for conference ticket',
 * ], {
 *   channel: 'email',
 *   approver: 'finance@company.com',
 * })
 *
 * const approved = results.filter(r => r.approved)
 * console.log(`Approved ${approved.length} of ${results.length} requests`)
 * ```
 */
approve.batch = async (
  requests: string[],
  options: ApprovalOptions = {}
): Promise<ApprovalResult[]> => {
  // Process approvals in parallel
  return Promise.all(requests.map((request) => approve(request, options)))
}
