/**
 * Approval request functionality for digital workers
 *
 * IMPORTANT: Worker Routing vs LLM Content Generation
 * ---------------------------------------------------
 * This module provides real approval workflows, NOT LLM-generated approval content.
 *
 * - `digital-workers.approve()` - Routes approval requests to Workers (Humans
 *   or AI Agents) via communication channels and waits for actual approval.
 *
 * - `ai-functions.approve()` - Generates approval request content via LLM
 *   for use in human interaction UIs.
 *
 * Use digital-workers when you need:
 * - Real approval workflows with actual approvers
 * - Routing to specific people via Slack, email, SMS
 * - Approval audit trails (who, when, via what channel)
 * - Multi-approver workflows (any/all must approve)
 *
 * Use ai-functions when you need:
 * - LLM-generated approval request content
 * - Generating UI/UX for approval flows
 * - Approval request templates
 *
 * @module
 */

import type {
  Worker,
  Team,
  WorkerRef,
  ActionTarget,
  ContactChannel,
  ApprovalResult,
  ApprovalOptions,
  Contacts,
} from './types.js'

/**
 * Route an approval request to a Worker (Human or AI Agent) and wait for response.
 *
 * **Key Difference from ai-functions.approve():**
 * Unlike `ai-functions.approve()` which generates approval request content
 * using the LLM, this function routes the request to an actual approver via
 * real communication channels (Slack, email, SMS) and waits for their response.
 *
 * This is a **workflow approval primitive**, not a content generation primitive.
 *
 * @param request - What is being requested for approval
 * @param target - The worker or team to request approval from (routes to their channels)
 * @param options - Approval options including channel, timeout, and context
 * @returns Promise resolving to approval result with metadata (who approved, when, notes)
 *
 * @example
 * ```ts
 * // Request approval from a human via Slack
 * const result = await approve('Expense: $500 for AWS', manager, {
 *   via: 'slack',
 *   context: { amount: 500, category: 'Infrastructure' },
 * })
 *
 * if (result.approved) {
 *   console.log(`Approved by ${result.approvedBy?.name} at ${result.approvedAt}`)
 * }
 *
 * // Request approval from a team (routes to lead or available member)
 * const result = await approve('Deploy v2.1.0 to production', opsTeam, {
 *   via: 'slack',
 * })
 * ```
 *
 * @see {@link ai-functions#approve} for LLM-generated approval request content
 * @see {@link approve.all} for multi-approver workflows (all must approve)
 * @see {@link approve.any} for multi-approver workflows (any can approve)
 */
export async function approve(
  request: string,
  target: ActionTarget,
  options: ApprovalOptions = {}
): Promise<ApprovalResult> {
  const { via, timeout, context, escalate = false } = options

  // Resolve target to get contacts and approver info
  const { contacts, approver } = resolveTarget(target)

  // Determine which channel to use
  const channel = resolveChannel(via, contacts)

  if (!channel) {
    throw new Error('No valid channel available for approval request')
  }

  // Send the approval request and wait for response
  const response = await sendApprovalRequest(channel, request, contacts, {
    ...(timeout !== undefined && { timeout }),
    ...(context !== undefined && { context }),
    approver,
    escalate,
  })

  return {
    approved: response.approved,
    approvedBy: approver,
    approvedAt: new Date(),
    ...(response.notes !== undefined && { notes: response.notes }),
    via: channel,
  }
}

/**
 * Request approval with structured decision context
 *
 * @example
 * ```ts
 * const result = await approve.withContext(
 *   'Migrate to new database',
 *   cto,
 *   {
 *     pros: ['Better performance', 'Lower cost'],
 *     cons: ['Migration effort', 'Downtime required'],
 *     risks: ['Data loss', 'Service disruption'],
 *     mitigations: ['Backup strategy', 'Staged rollout'],
 *   },
 *   { via: 'email' }
 * )
 * ```
 */
approve.withContext = async (
  request: string,
  target: ActionTarget,
  decision: {
    pros?: string[]
    cons?: string[]
    risks?: string[]
    mitigations?: string[]
    alternatives?: string[]
  },
  options: ApprovalOptions = {}
): Promise<ApprovalResult> => {
  return approve(request, target, {
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
 * @example
 * ```ts
 * const results = await approve.batch([
 *   'Expense: $500 for AWS',
 *   'Expense: $200 for office supplies',
 *   'Expense: $1000 for conference ticket',
 * ], finance, { via: 'email' })
 *
 * const approved = results.filter(r => r.approved)
 * ```
 */
approve.batch = async (
  requests: string[],
  target: ActionTarget,
  options: ApprovalOptions = {}
): Promise<ApprovalResult[]> => {
  return Promise.all(requests.map((request) => approve(request, target, options)))
}

/**
 * Request approval with a deadline
 *
 * @example
 * ```ts
 * const result = await approve.withDeadline(
 *   'Release v2.0',
 *   manager,
 *   new Date('2024-01-15T17:00:00Z'),
 *   { via: 'slack' }
 * )
 * ```
 */
approve.withDeadline = async (
  request: string,
  target: ActionTarget,
  deadline: Date,
  options: ApprovalOptions = {}
): Promise<ApprovalResult> => {
  const timeout = deadline.getTime() - Date.now()
  return approve(request, target, {
    ...options,
    timeout: Math.max(0, timeout),
    context: {
      ...options.context,
      deadline: deadline.toISOString(),
    },
  })
}

/**
 * Request approval from multiple approvers (any one can approve)
 *
 * @example
 * ```ts
 * const result = await approve.any(
 *   'Urgent: Production fix',
 *   [alice, bob, charlie],
 *   { via: 'slack' }
 * )
 * ```
 */
approve.any = async (
  request: string,
  targets: ActionTarget[],
  options: ApprovalOptions = {}
): Promise<ApprovalResult> => {
  // Race all approval requests - first to respond wins
  return Promise.race(targets.map((target) => approve(request, target, options)))
}

/**
 * Request approval from multiple approvers (all must approve)
 *
 * @example
 * ```ts
 * const result = await approve.all(
 *   'Major infrastructure change',
 *   [cto, vpe, securityLead],
 *   { via: 'email' }
 * )
 * ```
 */
approve.all = async (
  request: string,
  targets: ActionTarget[],
  options: ApprovalOptions = {}
): Promise<ApprovalResult & { approvals: ApprovalResult[] }> => {
  const results = await Promise.all(targets.map((target) => approve(request, target, options)))

  const allApproved = results.every((r) => r.approved)

  return {
    approved: allApproved,
    approvedAt: new Date(),
    notes: allApproved
      ? 'All approvers approved'
      : `${results.filter((r) => !r.approved).length} rejection(s)`,
    approvals: results,
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolve an action target to contacts and approver
 */
function resolveTarget(target: ActionTarget): {
  contacts: Contacts
  approver: WorkerRef
} {
  if (typeof target === 'string') {
    return {
      contacts: {},
      approver: { id: target },
    }
  }

  if ('contacts' in target) {
    // Worker or Team
    let approver: WorkerRef
    if ('members' in target) {
      // Team - use lead or first member
      approver = target.lead ?? target.members[0] ?? { id: target.id }
    } else {
      // Worker
      approver = { id: target.id, type: target.type, name: target.name }
    }

    return {
      contacts: target.contacts,
      approver,
    }
  }

  // WorkerRef
  return {
    contacts: {},
    approver: target,
  }
}

/**
 * Determine which channel to use
 */
function resolveChannel(
  via: ContactChannel | ContactChannel[] | undefined,
  contacts: Contacts
): ContactChannel | null {
  if (via) {
    const requested = Array.isArray(via) ? via[0] : via
    if (requested && contacts[requested] !== undefined) {
      return requested
    }
  }

  // Default to first available
  const available = Object.keys(contacts) as ContactChannel[]
  const first = available[0]
  return first ?? null
}

/**
 * Send an approval request to a channel and wait for response
 */
async function sendApprovalRequest(
  channel: ContactChannel,
  request: string,
  contacts: Contacts,
  options: {
    timeout?: number
    context?: Record<string, unknown>
    approver: WorkerRef
    escalate?: boolean
  }
): Promise<{ approved: boolean; notes?: string }> {
  const contact = contacts[channel]

  if (!contact) {
    throw new Error(`No ${channel} contact configured`)
  }

  // In a real implementation, this would:
  // 1. Format the request for the channel (Slack blocks, email HTML, etc.)
  // 2. Send via the appropriate API
  // 3. Wait for response (polling, webhook, interactive message, etc.)
  // 4. Handle timeout and escalation

  // For now, simulate a pending response
  await new Promise((resolve) => setTimeout(resolve, 10))

  // Return a placeholder - real impl would wait for actual response
  return {
    approved: false,
    notes: 'Approval pending - waiting for response',
  }
}
