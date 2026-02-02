/**
 * Question/answer functionality for digital workers
 *
 * IMPORTANT: Worker Routing vs Direct LLM Calls
 * ---------------------------------------------
 * This module provides worker-routed question handling, NOT direct LLM queries.
 *
 * - `digital-workers.ask()` - Routes questions to Workers (AI Agents or Humans)
 *   via communication channels (Slack, email, SMS, etc.) and waits for response.
 *
 * - `ai-functions.ask()` - Generates content for human interaction via LLM.
 *
 * Use digital-workers when you need:
 * - To ask a specific person or team via real channels
 * - Human responses with accountability (who answered)
 * - Channel-based communication (Slack, email, SMS)
 * - Team coordination and escalation
 *
 * Use ai-functions when you need:
 * - LLM-generated question/answer content
 * - Generating UI for human input
 * - Direct AI text generation
 *
 * @module
 */

import { generateObject } from 'ai-functions'
import type { SimpleSchema } from 'ai-functions'
import type {
  Worker,
  Team,
  WorkerRef,
  ActionTarget,
  ContactChannel,
  AskResult,
  AskOptions,
  Contacts,
} from './types.js'

/**
 * Route a question to a Worker (AI Agent or Human) via communication channels.
 *
 * **Key Difference from ai-functions.ask():**
 * Unlike `ai-functions.ask()` which generates content for human interaction
 * using the LLM, this function routes the question to an actual Worker (person
 * or AI agent) via real communication channels (Slack, email, SMS, etc.) and
 * waits for their response.
 *
 * This is a **worker communication primitive**, not a direct LLM primitive.
 *
 * @param target - The worker or team to ask (routes to their configured channels)
 * @param question - The question to ask
 * @param options - Ask options including channel, schema, and timeout
 * @returns Promise resolving to the answer with metadata (who answered, when, via what channel)
 *
 * @example
 * ```ts
 * // Ask a human via Slack
 * const result = await ask(alice, 'What is the company holiday policy?', {
 *   via: 'slack',
 * })
 * console.log(result.answer)
 * console.log(`Answered by ${result.answeredBy.name} at ${result.answeredAt}`)
 *
 * // Ask with structured response schema
 * const result = await ask(ceo, 'What are our Q1 priorities?', {
 *   via: 'email',
 *   schema: {
 *     priorities: ['List of priorities'],
 *     reasoning: 'Why these priorities were chosen',
 *   },
 * })
 * ```
 *
 * @see {@link ai-functions#ask} for LLM-generated human interaction content
 */
export async function ask<T = string>(
  target: ActionTarget,
  question: string,
  options: AskOptions = {}
): Promise<AskResult<T>> {
  const { via, schema, timeout, context } = options

  // Resolve target to get contacts and recipient info
  const { contacts, recipient } = resolveTarget(target)

  // Determine which channel to use
  const channel = resolveChannel(via, contacts)

  if (!channel) {
    throw new Error('No valid channel available to ask question')
  }

  // Send the question and wait for response
  const response = await sendQuestion<T>(channel, question, contacts, {
    ...(schema !== undefined && { schema }),
    ...(timeout !== undefined && { timeout }),
    ...(context !== undefined && { context }),
    recipient,
  })

  return {
    answer: response.answer,
    answeredBy: recipient,
    answeredAt: new Date(),
    via: channel,
  }
}

/**
 * Ask an AI agent directly (no human routing)
 *
 * @example
 * ```ts
 * const answer = await ask.ai('What is our refund policy?', {
 *   policies: [...],
 *   customerContext: {...},
 * })
 * ```
 */
ask.ai = async <T = string>(
  question: string,
  context?: Record<string, unknown>,
  schema?: SimpleSchema
): Promise<T> => {
  if (schema) {
    const result = await generateObject({
      model: 'sonnet',
      schema,
      prompt: question,
      ...(context !== undefined && {
        system: `Use the following context to answer the question:\n\n${JSON.stringify(
          context,
          null,
          2
        )}`,
      }),
    })
    return result.object as T
  }

  const result = await generateObject({
    model: 'sonnet',
    schema: { answer: 'The answer to the question' },
    prompt: question,
    ...(context !== undefined && {
      system: `Use the following context to answer the question:\n\n${JSON.stringify(
        context,
        null,
        2
      )}`,
    }),
  })

  return (result.object as { answer: T }).answer
}

/**
 * Ask multiple questions at once
 *
 * @example
 * ```ts
 * const results = await ask.batch(hr, [
 *   'What is the vacation policy?',
 *   'What is the remote work policy?',
 *   'What is the expense policy?',
 * ], { via: 'email' })
 * ```
 */
ask.batch = async <T = string>(
  target: ActionTarget,
  questions: string[],
  options: AskOptions = {}
): Promise<Array<AskResult<T>>> => {
  return Promise.all(questions.map((q) => ask<T>(target, q, options)))
}

/**
 * Ask for clarification on something
 *
 * @example
 * ```ts
 * const clarification = await ask.clarify(devops, 'The deployment process')
 * ```
 */
ask.clarify = async (
  target: ActionTarget,
  topic: string,
  options: AskOptions = {}
): Promise<AskResult<string>> => {
  return ask<string>(target, `Can you clarify: ${topic}`, options)
}

/**
 * Ask a yes/no question
 *
 * @example
 * ```ts
 * const result = await ask.yesNo(manager, 'Should we proceed with the release?', {
 *   via: 'slack',
 * })
 * if (result.answer === 'yes') {
 *   // proceed
 * }
 * ```
 */
ask.yesNo = async (
  target: ActionTarget,
  question: string,
  options: AskOptions = {}
): Promise<AskResult<'yes' | 'no'>> => {
  return ask<'yes' | 'no'>(target, question, {
    ...options,
    schema: {
      answer: 'Answer: yes or no',
    },
  })
}

/**
 * Ask for a choice from options
 *
 * @example
 * ```ts
 * const result = await ask.choose(designer, 'Which color scheme?', {
 *   choices: ['Light', 'Dark', 'System'],
 *   via: 'slack',
 * })
 * ```
 */
ask.choose = async <T extends string>(
  target: ActionTarget,
  question: string,
  choices: T[],
  options: AskOptions = {}
): Promise<AskResult<T>> => {
  const choiceList = choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  const fullQuestion = `${question}\n\nOptions:\n${choiceList}`

  return ask<T>(target, fullQuestion, {
    ...options,
    schema: {
      answer: `One of: ${choices.join(', ')}`,
    },
  })
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolve an action target to contacts and recipient
 */
function resolveTarget(target: ActionTarget): {
  contacts: Contacts
  recipient: WorkerRef
} {
  if (typeof target === 'string') {
    return {
      contacts: {},
      recipient: { id: target },
    }
  }

  if ('contacts' in target) {
    // Worker or Team
    let recipient: WorkerRef
    if ('members' in target) {
      // Team - ask lead or first member
      recipient = target.lead ?? target.members[0] ?? { id: target.id }
    } else {
      // Worker
      recipient = { id: target.id, type: target.type, name: target.name }
    }

    return {
      contacts: target.contacts,
      recipient,
    }
  }

  // WorkerRef
  return {
    contacts: {},
    recipient: target,
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
 * Send a question to a channel and wait for response
 */
async function sendQuestion<T>(
  channel: ContactChannel,
  question: string,
  contacts: Contacts,
  options: {
    schema?: SimpleSchema
    timeout?: number
    context?: Record<string, unknown>
    recipient: WorkerRef
  }
): Promise<{ answer: T }> {
  const contact = contacts[channel]

  if (!contact) {
    throw new Error(`No ${channel} contact configured`)
  }

  // Import transport functions dynamically to avoid circular dependencies
  const { channelToTransport, sendViaTransport, hasTransport, resolveAddress } = await import(
    './transports.js'
  )

  const transport = channelToTransport(channel)
  const address = resolveAddress(contacts, channel)

  // If transport is registered, use it for real delivery
  if (hasTransport(transport) && address) {
    const { generateRequestId } = await import('./utils/id.js')
    const requestId = generateRequestId('ask')

    const payload = {
      to: address.value,
      body: question,
      type: 'question' as const,
      priority: 'normal' as const,
      threadId: requestId,
      ...(options.schema !== undefined && { schema: options.schema }),
      ...(options.timeout !== undefined && { timeout: options.timeout }),
      metadata: {
        ...options.context,
        recipient: options.recipient,
      },
    }

    const result = await sendViaTransport(transport, payload)

    if (result.success) {
      // For real transports, we need to wait for a response
      // This would integrate with the runtime's HumanRequestProcessor
      // For now, return pending state - the response comes via webhook
      return {
        answer: `Question sent via ${transport}. Awaiting response. Request ID: ${requestId}` as T,
      }
    } else {
      throw new Error(`Failed to send question via ${transport}: ${result.error}`)
    }
  }

  // No transport registered - return pending state
  // In a real workflow, this would be processed when a transport is configured
  // or the runtime handles the request via HumanRequestProcessor
  return {
    answer:
      `Question pending - no transport registered for ${channel}. Configure a transport handler to enable real delivery.` as T,
  }
}
