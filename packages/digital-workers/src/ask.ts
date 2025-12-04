/**
 * Question/answer functionality for digital workers
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
 * Ask a question to a worker or team
 *
 * Routes questions through the specified channel and waits for a response.
 *
 * @param target - The worker or team to ask
 * @param question - The question to ask
 * @param options - Ask options
 * @returns Promise resolving to the answer
 *
 * @example
 * ```ts
 * // Ask a simple question
 * const result = await ask(alice, 'What is the company holiday policy?', {
 *   via: 'slack',
 * })
 * console.log(result.answer)
 *
 * // Ask with structured response
 * const result = await ask(ceo, 'What are our Q1 priorities?', {
 *   via: 'email',
 *   schema: {
 *     priorities: ['List of priorities'],
 *     reasoning: 'Why these priorities were chosen',
 *   },
 * })
 * ```
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
    schema,
    timeout,
    context,
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
      system: context
        ? `Use the following context to answer the question:\n\n${JSON.stringify(context, null, 2)}`
        : undefined,
    })
    return result.object as T
  }

  const result = await generateObject({
    model: 'sonnet',
    schema: { answer: 'The answer to the question' },
    prompt: question,
    system: context
      ? `Use the following context to answer the question:\n\n${JSON.stringify(context, null, 2)}`
      : undefined,
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

  // In a real implementation, this would:
  // 1. Format the question for the channel
  // 2. Send via the appropriate API
  // 3. Wait for response (polling, webhook, etc.)
  // 4. Parse and validate the response

  // For now, simulate a pending response
  await new Promise((resolve) => setTimeout(resolve, 10))

  // Return a placeholder - real impl would wait for actual response
  return {
    answer: 'Waiting for response...' as T,
  }
}
