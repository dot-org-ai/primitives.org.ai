/**
 * Actions - Core action functions for autonomous agents
 *
 * These are standalone functions that can be used independently
 * or as part of an agent's capabilities.
 *
 * @packageDocumentation
 */

import {
  generateObject,
  type AIGenerateOptions,
  type SimpleSchema,
  type JSONSchema,
} from 'ai-functions'
import { ask as askWorker } from 'digital-workers'
import type { Worker, WorkerDispatcher, WorkerAskInput, WorkerAskOutput } from 'digital-workers'
import type {
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
  NotificationOptions,
} from './types.js'
import { runAsk, runDo, runDecide, runGenerate, runIs } from './ask-dispatch.js'

/**
 * Execute a task using AI.
 *
 * @deprecated Import `do` from `digital-workers` instead. The action verbs
 * are now dispatched through the unified Worker port; this re-export
 * delegates through the shared `runDo` builder (so the `generateObject`
 * prompt + schema are unchanged) and logs a one-time deprecation notice.
 * PRD: route Layer 5 through digital-workers (aip-2q19).
 *
 * @example
 * ```ts
 * import { do as doTask } from 'digital-workers'
 * import { agentAsWorker } from 'autonomous-agents/worker'
 *
 * const result = await doTask(agentAsWorker(myAgent), 'Analyse feedback')
 * ```
 */
export async function doAction<TResult = unknown>(
  task: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  warnDeprecatedOnce(
    'autonomous-agents.do',
    "[autonomous-agents] DEPRECATED: `do` is now dispatched through the unified Worker port. Import `do` from 'digital-workers' (e.g. `do(agentAsWorker(agent), task)`). This re-export will be removed in the next minor release."
  )
  return runDo<TResult>(task, context, options)
}

/**
 * One-time deprecation notice tracker. Each deprecated export logs its notice
 * at most once per process.
 */
const deprecationNotified = new Set<string>()

/**
 * Log a deprecation notice once per process for the given key.
 * @internal exported for testing.
 */
export function warnDeprecatedOnce(key: string, message: string): void {
  if (deprecationNotified.has(key)) return
  deprecationNotified.add(key)
  console.warn(message)
}

/**
 * Reset the one-time deprecation tracker (test-only).
 * @internal
 */
export function __resetDeprecationNotices(): void {
  deprecationNotified.clear()
}

/**
 * A context-only Worker dispatcher that preserves the EXACT prior
 * `autonomous-agents.ask` behaviour: it passes only the caller-supplied
 * `options` (model / schema / system / temperature) into the shared
 * {@link runAsk} builder — no agent config is injected. Used by the deprecated
 * standalone `ask` so its delegation through `digital-workers.ask` is parity-
 * preserving.
 */
function contextOnlyAskDispatcher(options?: AIGenerateOptions): WorkerDispatcher {
  return {
    async ask<T = string>(input: WorkerAskInput): Promise<WorkerAskOutput<T>> {
      const merged: AIGenerateOptions = { ...options }
      if (input.schema !== undefined) {
        merged.schema = input.schema as unknown as JSONSchema
      }
      const answer = await runAsk<T>(input.question, input.context, merged)
      return { answer }
    },
  }
}

/**
 * Ask a question and get an answer.
 *
 * @deprecated Import `ask` from `digital-workers` instead. The action verbs
 * are now dispatched through the unified Worker port. This export delegates to
 * `digital-workers.ask` (routing through `ai-functions.generateObject` with
 * identical prompt + schema construction) and will be removed in the next
 * minor release. PRD: route Layer 5 through digital-workers (aip-qozi).
 *
 * @example
 * ```ts
 * import { ask } from 'digital-workers'
 * import { agentAsWorker } from 'autonomous-agents/worker'
 *
 * const answer = await ask(agentAsWorker(myAgent), 'What are the key benefits?')
 * ```
 */
export async function ask<TResult = unknown>(
  question: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  warnDeprecatedOnce(
    'autonomous-agents.ask',
    "[autonomous-agents] DEPRECATED: `ask` is now dispatched through the unified Worker port. Import `ask` from 'digital-workers' (e.g. `ask(agentAsWorker(agent), question)`). This re-export will be removed in the next minor release."
  )

  // Delegate to the canonical digital-workers.ask via a context-only Worker.
  // The dispatcher routes through the shared runAsk builder, so the
  // generateObject prompt + schema match the prior implementation exactly.
  const worker: Worker = {
    id: 'autonomous-agents:ask',
    name: 'autonomous-agents ask',
    type: 'agent',
    status: 'available',
    contacts: {},
    dispatch: contextOnlyAskDispatcher(options),
  }

  const result = await askWorker<TResult>(worker, question, {
    ...(context !== undefined && { context: context as Record<string, unknown> }),
    ...(options?.schema !== undefined && { schema: options.schema as SimpleSchema }),
  })

  return result.answer
}

/**
 * Make a decision between options.
 *
 * @deprecated Import `decide` from `digital-workers` instead. The action
 * verbs are now dispatched through the unified Worker port; this re-export
 * delegates through the shared `runDecide` builder (so the `generateObject`
 * prompt + schema are unchanged) and logs a one-time deprecation notice.
 * PRD: route Layer 5 through digital-workers (aip-2q19).
 *
 * @example
 * ```ts
 * import { decide } from 'digital-workers'
 * import { agentAsWorker } from 'autonomous-agents/worker'
 *
 * const choice = await decide(agentAsWorker(myAgent), { options: ['A', 'B'] })
 * ```
 */
export async function decide<T extends string>(
  options: T[],
  context?: string,
  settings?: AIGenerateOptions
): Promise<T> {
  warnDeprecatedOnce(
    'autonomous-agents.decide',
    "[autonomous-agents] DEPRECATED: `decide` is now dispatched through the unified Worker port. Import `decide` from 'digital-workers' (e.g. `decide(agentAsWorker(agent), { options })`). This re-export will be removed in the next minor release."
  )
  return runDecide<T>(options, context, settings)
}

/**
 * Request approval for an action or decision
 *
 * @example
 * ```ts
 * import { approve } from 'autonomous-agents'
 *
 * const approval = await approve({
 *   title: 'Budget Request',
 *   description: 'Request $50k for marketing campaign',
 *   data: { amount: 50000, campaign: 'Q1 Launch' },
 *   approver: 'manager@company.com',
 *   priority: 'high',
 * })
 *
 * if (approval.status === 'approved') {
 *   // Proceed with the action
 * }
 * ```
 */
export async function approve<TResult = unknown>(
  request: ApprovalRequest
): Promise<ApprovalResult<TResult>> {
  return executeApproval(request)
}

/**
 * Execute approval request (internal implementation)
 */
export async function executeApproval<TResult = unknown>(
  request: ApprovalRequest
): Promise<ApprovalResult<TResult>> {
  // Generate approval UI based on channel
  const uiSchema = getApprovalUISchema(request.channel || 'web')

  const result = await generateObject({
    model: 'sonnet',
    schema: uiSchema,
    system: `Generate ${request.channel || 'web'} UI/content for an approval request.`,
    prompt: `Approval Request: ${request.title}

Description: ${request.description}

Data to be approved:
${JSON.stringify(request.data, null, 2)}

Priority: ${request.priority || 'medium'}
Approver: ${request.approver || 'any authorized approver'}

${
  request.responseSchema
    ? `Expected response format:\n${JSON.stringify(request.responseSchema)}`
    : ''
}

Generate the appropriate UI/content to collect approval or rejection with optional notes.`,
  })

  // In a real implementation, this would:
  // 1. Send the generated UI to the specified channel
  // 2. Wait for human response (with timeout)
  // 3. Return the validated response

  // For now, return a pending approval with generated artifacts
  return {
    status: 'pending' as ApprovalStatus,
    response: undefined,
    timestamp: new Date(),
  } as ApprovalResult<TResult>
}

/**
 * Get approval UI schema based on channel
 */
function getApprovalUISchema(channel: string): SimpleSchema {
  const schemas: Record<string, SimpleSchema> = {
    slack: {
      blocks: ['Slack BlockKit blocks as JSON array'],
      text: 'Plain text fallback',
    },
    email: {
      subject: 'Email subject line',
      html: 'Email HTML body with approval buttons',
      text: 'Plain text fallback',
    },
    web: {
      component: 'React component code for approval form',
      schema: 'JSON schema for the form fields',
    },
    sms: {
      text: 'SMS message text (max 160 chars)',
      responseFormat: 'Expected response format',
    },
    custom: {
      data: 'Structured data for custom implementation',
      instructions: 'Instructions for the approver',
    },
  }

  return schemas[channel] || schemas['custom']!
}

/**
 * Generate content using AI.
 *
 * @deprecated Import `generate` from `digital-workers` instead. The action
 * verbs are now dispatched through the unified Worker port; this re-export
 * delegates through the shared `runGenerate` builder (so the `generateObject`
 * prompt + schema are unchanged) and logs a one-time deprecation notice.
 * PRD: route Layer 5 through digital-workers (aip-2q19).
 *
 * @example
 * ```ts
 * import { generate } from 'digital-workers'
 * import { agentAsWorker } from 'autonomous-agents/worker'
 *
 * const content = await generate(agentAsWorker(myAgent), 'Write a blog post', {
 *   schema: { title: 'Blog post title', content: 'Blog post content' },
 * })
 * ```
 */
export async function generate<TResult = unknown>(options: AIGenerateOptions): Promise<TResult> {
  warnDeprecatedOnce(
    'autonomous-agents.generate',
    "[autonomous-agents] DEPRECATED: `generate` is now dispatched through the unified Worker port. Import `generate` from 'digital-workers' (e.g. `generate(agentAsWorker(agent), prompt, { schema })`). This re-export will be removed in the next minor release."
  )
  return runGenerate<TResult>(options)
}

/**
 * Type checking and validation
 *
 * @example
 * ```ts
 * import { is } from 'autonomous-agents'
 *
 * const isValid = await is(
 *   { email: 'test@example.com' },
 *   'valid email address'
 * )
 *
 * const matchesSchema = await is(
 *   { name: 'John', age: 30 },
 *   { name: 'string', age: 'number' }
 * )
 * ```
 */
export async function is(value: unknown, type: string | SimpleSchema): Promise<boolean> {
  warnDeprecatedOnce(
    'autonomous-agents.is',
    "[autonomous-agents] DEPRECATED: `is` is now dispatched through the unified Worker port. Import `is` from 'digital-workers' (e.g. `is(agentAsWorker(agent), value, type)`). This re-export will be removed in the next minor release."
  )
  return runIs(value, type)
}

/**
 * Send a notification
 *
 * @example
 * ```ts
 * import { notify } from 'autonomous-agents'
 *
 * await notify({
 *   message: 'Task completed successfully!',
 *   channel: 'slack',
 *   recipients: ['#general'],
 *   priority: 'high',
 *   data: { taskId: '123', duration: '5 minutes' },
 * })
 * ```
 */
export async function notify(options: NotificationOptions): Promise<void> {
  const { message, channel = 'web', recipients = [], priority = 'medium', data = {} } = options

  // Generate channel-specific notification format
  const notificationSchema = getNotificationSchema(channel)

  const result = await generateObject({
    model: 'sonnet',
    schema: notificationSchema,
    system: `Generate ${channel} notification content.`,
    prompt: `Notification message: ${message}

Recipients: ${recipients.join(', ') || 'default recipients'}
Priority: ${priority}

Additional data:
${JSON.stringify(data, null, 2)}

Generate the appropriate ${channel} notification format.`,
  })

  // In a real implementation, this would send via the specified channel
  console.log(`[Notification] [${channel}] ${message}`, result.object)
}

/**
 * Get notification schema based on channel
 */
function getNotificationSchema(channel: string): SimpleSchema {
  const schemas: Record<string, SimpleSchema> = {
    slack: {
      blocks: ['Slack BlockKit blocks'],
      text: 'Plain text fallback',
    },
    email: {
      subject: 'Email subject',
      html: 'Email HTML body',
      text: 'Plain text version',
    },
    web: {
      title: 'Notification title',
      message: 'Notification message',
      type: 'success | info | warning | error',
    },
    sms: {
      text: 'SMS message (max 160 chars)',
    },
    custom: {
      format: 'Custom notification format',
      content: 'Notification content',
    },
  }

  return schemas[channel] || schemas['custom']!
}

/**
 * Export the 'do' function with an alias to avoid keyword conflict
 */
export { doAction as do }
