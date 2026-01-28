/**
 * Worker Actions - Workflow Integration
 *
 * Worker actions (notify, ask, approve, decide, do) are durable workflow actions
 * that integrate with ai-workflows. They can be invoked via:
 *
 * 1. `$.do('Worker.notify', data)` - Durable action
 * 2. `$.send('Worker.notify', data)` - Fire and forget
 * 3. `$.notify(target, message)` - Convenience method (when using withWorkers)
 *
 * @packageDocumentation
 */

import type { WorkflowContext } from 'ai-workflows'
import { generateRequestId } from './utils/id.js'
import type {
  Worker,
  Team,
  WorkerRef,
  ActionTarget,
  ContactChannel,
  Contacts,
  NotifyActionData,
  AskActionData,
  ApproveActionData,
  DecideActionData,
  DoActionData,
  NotifyResult,
  AskResult,
  ApprovalResult,
  DecideResult,
  DoResult,
  NotifyOptions,
  AskOptions,
  ApproveOptions,
  DecideOptions,
  WorkerContext,
} from './types.js'

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Handle Worker.notify action
 */
export async function handleNotify(
  data: NotifyActionData,
  $: WorkflowContext
): Promise<NotifyResult> {
  const { object: target, message, via, priority = 'normal' } = data

  // Resolve target to get contacts
  const { contacts, recipients } = resolveTarget(target)

  // Determine which channels to use
  const channels = resolveChannels(via, contacts, priority)

  if (channels.length === 0) {
    return {
      sent: false,
      via: [],
      sentAt: new Date(),
      messageId: generateId('msg'),
    }
  }

  // Send to each channel
  const delivery = await Promise.all(
    channels.map(async (channel) => {
      try {
        await sendToChannel(channel, message, contacts, { priority })
        return { channel, status: 'sent' as const }
      } catch (error) {
        return {
          channel,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  )

  const sent = delivery.some((d) => d.status === 'sent')
  const result: NotifyResult = {
    sent,
    via: channels,
    recipients,
    sentAt: new Date(),
    messageId: generateId('msg'),
    delivery,
  }

  // Emit result event
  if (sent) {
    await $.send('Worker.notified', { ...data, result })
  }

  return result
}

/**
 * Handle Worker.ask action
 */
export async function handleAsk<T = string>(
  data: AskActionData,
  $: WorkflowContext
): Promise<AskResult<T>> {
  const { object: target, question, via, schema, timeout } = data

  // Resolve target
  const { contacts, recipients } = resolveTarget(target)
  const recipient = recipients[0]

  // Determine channel
  const channel = resolveChannel(via, contacts)

  if (!channel) {
    throw new Error('No valid channel available for ask action')
  }

  // Send question and wait for response
  const answer = await sendQuestion<T>(channel, question, contacts, {
    ...(schema !== undefined && { schema }),
    ...(timeout !== undefined && { timeout }),
  })

  const result: AskResult<T> = {
    answer,
    ...(recipient !== undefined && { answeredBy: recipient }),
    answeredAt: new Date(),
    via: channel,
  }

  // Emit result event
  await $.send('Worker.answered', { ...data, result })

  return result
}

/**
 * Handle Worker.approve action
 */
export async function handleApprove(
  data: ApproveActionData,
  $: WorkflowContext
): Promise<ApprovalResult> {
  const { object: target, request, via, context, timeout, escalate } = data

  // Resolve target
  const { contacts, recipients } = resolveTarget(target)
  const approver = recipients[0]

  // Determine channel
  const channel = resolveChannel(via, contacts)

  if (!channel) {
    throw new Error('No valid channel available for approve action')
  }

  // Send approval request and wait for response
  const response = await sendApprovalRequest(channel, request, contacts, {
    ...(context !== undefined && { context }),
    ...(timeout !== undefined && { timeout }),
    ...(escalate !== undefined && { escalate }),
  })

  const result: ApprovalResult = {
    approved: response.approved,
    ...(approver !== undefined && { approvedBy: approver }),
    approvedAt: new Date(),
    ...(response.notes !== undefined && { notes: response.notes }),
    via: channel,
  }

  // Emit result event
  await $.send(result.approved ? 'Worker.approved' : 'Worker.rejected', { ...data, result })

  return result
}

/**
 * Handle Worker.decide action
 */
export async function handleDecide<T = string>(
  data: DecideActionData,
  $: WorkflowContext
): Promise<DecideResult<T>> {
  const { options, context, criteria } = data

  // Use AI to make decision
  const result = await makeDecision<T>(options as T[], context, criteria)

  // Emit result event
  await $.send('Worker.decided', { ...data, result })

  return result
}

/**
 * Handle Worker.do action
 */
export async function handleDo<T = unknown>(
  data: DoActionData,
  $: WorkflowContext
): Promise<DoResult<T>> {
  const { object: target, instruction, timeout, maxRetries = 3 } = data

  const startTime = Date.now()
  const steps: DoResult<T>['steps'] = []

  let lastError: Error | undefined
  let result: T | undefined

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      steps.push({
        action: attempt === 0 ? 'start' : `retry_${attempt}`,
        result: { instruction },
        timestamp: new Date(),
      })

      // Execute the task (this would integrate with agent execution)
      result = await executeTask<T>(target, instruction, {
        ...(timeout !== undefined && { timeout }),
      })

      steps.push({
        action: 'complete',
        result,
        timestamp: new Date(),
      })

      const doResult: DoResult<T> = {
        result: result as T,
        success: true,
        duration: Date.now() - startTime,
        steps,
      }

      await $.send('Worker.done', { ...data, result: doResult })
      return doResult
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      steps.push({
        action: 'error',
        result: { error: lastError.message, attempt },
        timestamp: new Date(),
      })
    }
  }

  // All retries failed
  const failResult: DoResult<T> = {
    result: undefined as T,
    success: false,
    ...(lastError !== undefined && { error: lastError.message }),
    duration: Date.now() - startTime,
    steps,
  }

  await $.send('Worker.failed', { ...data, result: failResult })
  return failResult
}

// ============================================================================
// Workflow Extension
// ============================================================================

/**
 * Register Worker action handlers with a workflow
 *
 * @example
 * ```ts
 * import { Workflow } from 'ai-workflows'
 * import { registerWorkerActions } from 'digital-workers'
 *
 * const workflow = Workflow($ => {
 *   registerWorkerActions($)
 *
 *   $.on.Expense.submitted(async (expense, $) => {
 *     const approval = await $.do('Worker.approve', {
 *       actor: 'system',
 *       object: manager,
 *       request: `Expense: $${expense.amount}`,
 *       via: 'slack',
 *     })
 *   })
 * })
 * ```
 */
export function registerWorkerActions($: WorkflowContext): void {
  // Register action handlers using the proxy pattern
  // The $ context provides event registration via $.on[Namespace][event]
  const on = $.on as Record<string, Record<string, (handler: unknown) => void>>

  if (on['Worker']) {
    on['Worker']['notify']?.(handleNotify)
    on['Worker']['ask']?.(handleAsk)
    on['Worker']['approve']?.(handleApprove)
    on['Worker']['decide']?.(handleDecide)
    on['Worker']['do']?.(handleDo)
  }
}

/**
 * Extend WorkflowContext with convenience methods for worker actions
 *
 * @example
 * ```ts
 * const workflow = Workflow($ => {
 *   const worker$ = withWorkers($)
 *
 *   $.on.Expense.submitted(async (expense) => {
 *     await worker$.notify(finance, `New expense: ${expense.amount}`)
 *
 *     const approval = await worker$.approve(
 *       `Expense: $${expense.amount}`,
 *       manager,
 *       { via: 'slack' }
 *     )
 *   })
 * })
 * ```
 */
export function withWorkers($: WorkflowContext): WorkflowContext & WorkerContext {
  const workerContext: WorkerContext = {
    async notify(
      target: ActionTarget,
      message: string,
      options: NotifyOptions = {}
    ): Promise<NotifyResult> {
      // Workflow handler returns NotifyResult; $.do passes through the result
      return $.do<NotifyResult>('Worker.notify', {
        actor: 'system',
        object: target,
        action: 'notify',
        message,
        ...options,
      } as NotifyActionData)
    },

    async ask<T = string>(
      target: ActionTarget,
      question: string,
      options: AskOptions = {}
    ): Promise<AskResult<T>> {
      return $.do<AskResult<T>>('Worker.ask', {
        actor: 'system',
        object: target,
        action: 'ask',
        question,
        ...options,
      } as AskActionData)
    },

    async approve(
      request: string,
      target: ActionTarget,
      options: ApproveOptions = {}
    ): Promise<ApprovalResult> {
      // Convert ActionTarget to a suitable actor reference
      const actor: string | WorkerRef =
        typeof target === 'string'
          ? target
          : 'id' in target
          ? {
              id: target.id,
              ...('type' in target && target.type !== undefined && { type: target.type }),
              ...('name' in target && target.name !== undefined && { name: target.name }),
            }
          : 'system'

      return $.do<ApprovalResult>('Worker.approve', {
        actor,
        object: target,
        action: 'approve',
        request,
        ...options,
      } as ApproveActionData)
    },

    async decide<T = string>(options: DecideOptions<T>): Promise<DecideResult<T>> {
      return $.do<DecideResult<T>>('Worker.decide', {
        actor: 'ai',
        object: 'decision',
        action: 'decide',
        ...options,
      } as DecideActionData)
    },
  }

  return { ...$, ...workerContext }
}

// ============================================================================
// Standalone Functions (for use outside workflows)
// ============================================================================

/**
 * Send a notification (standalone, non-durable)
 */
export async function notify(
  target: ActionTarget,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const { contacts, recipients } = resolveTarget(target)
  const channels = resolveChannels(options.via, contacts, options.priority || 'normal')

  if (channels.length === 0) {
    return { sent: false, via: [], messageId: generateId('msg') }
  }

  const delivery = await Promise.all(
    channels.map(async (channel) => {
      try {
        await sendToChannel(channel, message, contacts, {
          ...(options.priority !== undefined && { priority: options.priority }),
        })
        return { channel, status: 'sent' as const }
      } catch (error) {
        return { channel, status: 'failed' as const, error: String(error) }
      }
    })
  )

  return {
    sent: delivery.some((d) => d.status === 'sent'),
    via: channels,
    recipients,
    sentAt: new Date(),
    messageId: generateId('msg'),
    delivery,
  }
}

/**
 * Ask a question (standalone, non-durable)
 */
export async function ask<T = string>(
  target: ActionTarget,
  question: string,
  options: AskOptions = {}
): Promise<AskResult<T>> {
  const { contacts, recipients } = resolveTarget(target)
  const channel = resolveChannel(options.via, contacts)

  if (!channel) {
    throw new Error('No valid channel available')
  }

  const answer = await sendQuestion<T>(channel, question, contacts, options)

  return {
    answer,
    ...(recipients[0] !== undefined && { answeredBy: recipients[0] }),
    answeredAt: new Date(),
    via: channel,
  }
}

/**
 * Request approval (standalone, non-durable)
 */
export async function approve(
  request: string,
  target: ActionTarget,
  options: ApproveOptions = {}
): Promise<ApprovalResult> {
  const { contacts, recipients } = resolveTarget(target)
  const channel = resolveChannel(options.via, contacts)

  if (!channel) {
    throw new Error('No valid channel available')
  }

  const response = await sendApprovalRequest(channel, request, contacts, options)

  return {
    approved: response.approved,
    ...(recipients[0] !== undefined && { approvedBy: recipients[0] }),
    approvedAt: new Date(),
    ...(response.notes !== undefined && { notes: response.notes }),
    via: channel,
  }
}

/**
 * Make a decision (standalone, non-durable)
 */
export async function decide<T = string>(options: DecideOptions<T>): Promise<DecideResult<T>> {
  return makeDecision(options.options, options.context, options.criteria)
}

// ============================================================================
// Internal Helpers
// ============================================================================

function resolveTarget(target: ActionTarget): {
  contacts: Contacts
  recipients: WorkerRef[]
} {
  if (typeof target === 'string') {
    return { contacts: {}, recipients: [{ id: target }] }
  }

  if ('contacts' in target) {
    const recipients: WorkerRef[] =
      'members' in target
        ? target.members
        : [{ id: target.id, type: target.type, name: target.name }]
    return { contacts: target.contacts, recipients }
  }

  return { contacts: {}, recipients: [target] }
}

function resolveChannels(
  via: ContactChannel | ContactChannel[] | undefined,
  contacts: Contacts,
  priority: string
): ContactChannel[] {
  if (via) {
    const requested = Array.isArray(via) ? via : [via]
    return requested.filter((c) => contacts[c] !== undefined)
  }

  const available = Object.keys(contacts) as ContactChannel[]
  if (available.length === 0) return []

  const firstChannel = available[0]
  if (!firstChannel) return []

  if (priority === 'urgent') {
    const urgentChannels: ContactChannel[] = ['slack', 'sms', 'phone']
    const urgent = available.filter((c) => urgentChannels.includes(c))
    return urgent.length > 0 ? urgent : [firstChannel]
  }

  return [firstChannel]
}

function resolveChannel(
  via: ContactChannel | ContactChannel[] | undefined,
  contacts: Contacts
): ContactChannel | null {
  if (via) {
    const channel = Array.isArray(via) ? via[0] : via
    if (channel && contacts[channel] !== undefined) return channel
  }
  const available = Object.keys(contacts) as ContactChannel[]
  const first = available[0]
  return first ?? null
}

async function sendToChannel(
  channel: ContactChannel,
  message: string,
  contacts: Contacts,
  options: { priority?: string }
): Promise<void> {
  // In a real implementation, this would send via Slack API, SendGrid, Twilio, etc.
  await new Promise((resolve) => setTimeout(resolve, 10))
}

async function sendQuestion<T>(
  channel: ContactChannel,
  question: string,
  contacts: Contacts,
  options: { schema?: unknown; timeout?: number }
): Promise<T> {
  // In a real implementation, this would send the question and wait for response
  await new Promise((resolve) => setTimeout(resolve, 10))
  return 'Pending response...' as T
}

async function sendApprovalRequest(
  channel: ContactChannel,
  request: string,
  contacts: Contacts,
  options: { context?: unknown; timeout?: number; escalate?: boolean }
): Promise<{ approved: boolean; notes?: string }> {
  // In a real implementation, this would send approval request and wait
  await new Promise((resolve) => setTimeout(resolve, 10))
  return { approved: false, notes: 'Pending approval...' }
}

async function makeDecision<T>(
  options: T[],
  context?: string | Record<string, unknown>,
  criteria?: string[]
): Promise<DecideResult<T>> {
  if (options.length === 0) {
    throw new Error('At least one option is required for a decision')
  }

  // In a real implementation, this would use AI to make a decision
  // For now, return first option with mock data
  const choice = options[0] as T
  return {
    choice,
    reasoning: 'Decision pending...',
    confidence: 0.5,
    alternatives: options.slice(1).map((opt, i) => ({
      option: opt,
      score: 50 - i * 10,
    })),
  }
}

async function executeTask<T>(
  target: ActionTarget,
  instruction: string,
  options: { timeout?: number }
): Promise<T> {
  // In a real implementation, this would execute the task via the target worker
  await new Promise((resolve) => setTimeout(resolve, 10))
  return { completed: true, instruction } as T
}

function generateId(prefix: string): string {
  return generateRequestId(prefix)
}
