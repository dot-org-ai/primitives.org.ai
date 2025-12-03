/**
 * Question/answer functionality for digital workers
 */

import { define, generateObject } from 'ai-functions'
import type { SimpleSchema } from 'ai-functions'
import type { AskResult, AskOptions } from './types.js'

/**
 * Ask a question to a human or AI agent
 *
 * Routes questions through appropriate channels and handles
 * both structured and unstructured responses.
 *
 * @param question - The question to ask
 * @param options - Ask options (channel, who to ask, schema, etc.)
 * @returns Promise resolving to the answer
 *
 * @example
 * ```ts
 * // Ask a simple question
 * const result = await ask('What is the company holiday policy?', {
 *   channel: 'slack',
 *   askee: 'hr@company.com',
 * })
 * console.log(result.answer)
 * ```
 *
 * @example
 * ```ts
 * // Ask with structured response
 * const result = await ask('What are our Q1 priorities?', {
 *   channel: 'email',
 *   askee: 'ceo@company.com',
 *   schema: {
 *     priorities: ['List of priorities'],
 *     reasoning: 'Why these priorities were chosen',
 *   },
 * })
 * console.log(result.answer) // { priorities: [...], reasoning: '...' }
 * ```
 */
export async function ask<T = string>(
  question: string,
  options: AskOptions = {}
): Promise<AskResult<T>> {
  const {
    channel = 'web',
    askee,
    timeout,
    schema,
    context,
  } = options

  // If a schema is provided, use structured response
  if (schema) {
    // Use human function for structured input
    const askFn = define.human({
      name: 'askQuestion',
      description: 'Ask a question and get a structured response',
      args: {
        question: 'The question to ask',
        contextInfo: 'Additional context for answering',
      },
      returnType: schema,
      channel,
      instructions: `Please answer the following question:

${question}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Provide your answer in the requested format.`,
      assignee: askee,
      timeout,
    })

    const response = await askFn.call({
      question,
      contextInfo: context ? JSON.stringify(context) : '',
    }) as unknown

    const typedResponse = response as { _pending?: boolean } & T

    // If pending, return pending status
    if (typedResponse._pending) {
      return {
        answer: 'Waiting for response...' as T,
        channel,
      }
    }

    return {
      answer: typedResponse as T,
      answeredBy: askee,
      answeredAt: new Date(),
      channel,
    }
  }

  // For unstructured questions, use simple text response
  const askFn = define.human({
    name: 'askSimpleQuestion',
    description: 'Ask a question and get a text response',
    args: {
      question: 'The question to ask',
      contextInfo: 'Additional context for answering',
    },
    returnType: {
      answer: 'The answer to the question',
    },
    channel,
    instructions: `Please answer the following question:

${question}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}`,
    assignee: askee,
    timeout,
  })

  const response = await askFn.call({
    question,
    contextInfo: context ? JSON.stringify(context) : '',
  }) as unknown

  const typedResponse = response as { answer: string; _pending?: boolean }

  if (typedResponse._pending) {
    return {
      answer: 'Waiting for response...' as T,
      channel,
    }
  }

  return {
    answer: typedResponse.answer as T,
    answeredBy: askee,
    answeredAt: new Date(),
    channel,
  }
}

/**
 * Ask a question and get an AI-generated answer
 *
 * Uses AI to answer the question based on available context.
 *
 * @param question - The question to ask
 * @param context - Context for the AI to use when answering
 * @param schema - Optional schema for structured response
 * @returns Promise resolving to the answer
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
 * @param questions - Array of questions
 * @param options - Ask options
 * @returns Promise resolving to array of answers
 *
 * @example
 * ```ts
 * const results = await ask.batch([
 *   'What is the vacation policy?',
 *   'What is the remote work policy?',
 *   'What is the expense policy?',
 * ], {
 *   channel: 'email',
 *   askee: 'hr@company.com',
 * })
 * ```
 */
ask.batch = async <T = string>(
  questions: string[],
  options: AskOptions = {}
): Promise<Array<AskResult<T>>> => {
  return Promise.all(questions.map((q) => ask<T>(q, options)))
}

/**
 * Ask for clarification on something
 *
 * @param statement - The statement to clarify
 * @param options - Ask options
 * @returns Promise resolving to clarification
 *
 * @example
 * ```ts
 * const clarification = await ask.clarify(
 *   'The deployment process is unclear',
 *   { askee: 'devops@company.com' }
 * )
 * ```
 */
ask.clarify = async (
  statement: string,
  options: AskOptions = {}
): Promise<AskResult<string>> => {
  return ask<string>(
    `Can you clarify: ${statement}`,
    options
  )
}
