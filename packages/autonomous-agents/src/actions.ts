/**
 * Actions - Core action functions for autonomous agents
 *
 * These are standalone functions that can be used independently
 * or as part of an agent's capabilities.
 *
 * @packageDocumentation
 */

import { generateObject, type AIGenerateOptions, type SimpleSchema } from 'ai-functions'
import type {
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
  NotificationOptions,
} from './types.js'

/**
 * Execute a task using AI
 *
 * @example
 * ```ts
 * import { do as doTask } from 'autonomous-agents'
 *
 * const result = await doTask('Analyze customer feedback and provide insights', {
 *   feedback: ['Great product!', 'Needs improvement', 'Love the features'],
 * })
 * ```
 */
export async function doAction<TResult = unknown>(
  task: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  const result = await generateObject({
    model: options?.model || 'sonnet',
    schema: options?.schema || { result: 'The result of the task' },
    system:
      options?.system || 'You are a helpful AI assistant. Execute tasks accurately and thoroughly.',
    prompt: `Task: ${task}\n\nContext: ${JSON.stringify(context || {})}`,
    temperature: options?.temperature ?? 0.7,
  })

  return (result.object as { result: TResult }).result || (result.object as TResult)
}

/**
 * Ask a question and get an answer
 *
 * @example
 * ```ts
 * import { ask } from 'autonomous-agents'
 *
 * const answer = await ask('What are the key benefits of our product?', {
 *   product: 'AI Assistant',
 *   features: ['smart automation', 'natural language', 'context awareness'],
 * })
 * ```
 */
export async function ask<TResult = unknown>(
  question: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  const result = await generateObject({
    model: options?.model || 'sonnet',
    schema: options?.schema || {
      answer: 'The answer to the question',
      reasoning: 'Supporting reasoning',
    },
    system:
      options?.system || 'You are a knowledgeable AI assistant. Provide clear, accurate answers.',
    prompt: `Question: ${question}\n\nContext: ${JSON.stringify(context || {})}`,
    temperature: options?.temperature ?? 0.7,
  })

  const response = result.object as { answer: TResult; reasoning: string }
  return response.answer
}

/**
 * Make a decision between options
 *
 * @example
 * ```ts
 * import { decide } from 'autonomous-agents'
 *
 * const choice = await decide(
 *   ['option A', 'option B', 'option C'],
 *   'Which option has the highest ROI?'
 * )
 * ```
 */
export async function decide<T extends string>(
  options: T[],
  context?: string,
  settings?: AIGenerateOptions
): Promise<T> {
  const result = await generateObject({
    model: settings?.model || 'sonnet',
    schema: {
      decision: options.join(' | '),
      reasoning: 'Reasoning for this decision',
      confidence: 'Confidence level 0-100 (number)',
    } as SimpleSchema,
    system:
      settings?.system ||
      'You are a strategic decision-maker. Evaluate options carefully and provide clear reasoning.',
    prompt: `Make a decision between these options:\n${options
      .map((o, i) => `${i + 1}. ${o}`)
      .join('\n')}\n\nContext: ${context || 'No additional context'}`,
    temperature: settings?.temperature ?? 0.7,
  })

  const response = result.object as unknown as {
    decision: T
    reasoning: string
    confidence: number
  }

  return response.decision
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
 * Generate content using AI
 *
 * @example
 * ```ts
 * import { generate } from 'autonomous-agents'
 *
 * const content = await generate({
 *   model: 'sonnet',
 *   schema: {
 *     title: 'Blog post title',
 *     content: 'Blog post content',
 *     tags: ['List of tags'],
 *   },
 *   prompt: 'Write a blog post about AI automation',
 * })
 * ```
 */
export async function generate<TResult = unknown>(options: AIGenerateOptions): Promise<TResult> {
  const result = await generateObject({
    model: options.model || 'sonnet',
    schema: (options.schema || { result: 'Generated content' }) as SimpleSchema,
    system: options.system || 'You are a creative AI assistant. Generate high-quality content.',
    prompt: options.prompt || '',
    temperature: options.temperature ?? 0.8,
  })

  return result.object as TResult
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
  const schema =
    typeof type === 'string'
      ? { isValid: `Is this value a valid ${type}? (boolean)`, reason: 'Explanation' }
      : { isValid: 'Does this value match the schema? (boolean)', reason: 'Explanation' }

  const result = await generateObject({
    model: 'sonnet',
    schema,
    system: 'You are a type validator. Determine if the value matches the expected type or schema.',
    prompt: `Value: ${JSON.stringify(value)}\n\nExpected type: ${
      typeof type === 'string' ? type : JSON.stringify(type)
    }`,
    temperature: 0,
  })

  return (result.object as unknown as { isValid: boolean; reason: string }).isValid
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
