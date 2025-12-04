/**
 * Approval request functionality for digital workers
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
 * Request approval from a worker or team
 *
 * Routes approval requests through the specified channel and waits for a response.
 *
 * @param request - What is being requested for approval
 * @param target - The worker or team to request approval from
 * @param options - Approval options
 * @returns Promise resolving to approval result
 *
 * @example
 * ```ts
 * // Request approval from a worker
 * const result = await approve('Expense: $500 for AWS', manager, {
 *   via: 'slack',
 *   context: { amount: 500, category: 'Infrastructure' },
 * })
 *
 * if (result.approved) {
 *   console.log(`Approved by ${result.approvedBy?.name}`)
 * }
 *
 * // Request approval from a team
 * const result = await approve('Deploy v2.1.0 to production', opsTeam, {
 *   via: 'slack',
 * })
 * ```
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
    timeout,
    context,
    approver,
    escalate,
  })

  return {
    approved: response.approved,
    approvedBy: approver,
    approvedAt: new Date(),
    notes: response.notes,
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
