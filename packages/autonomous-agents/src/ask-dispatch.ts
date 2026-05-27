/**
 * Shared `ask` dispatch — the single source of truth for how an Agent answers
 * a question via `ai-functions.generateObject`.
 *
 * Two callers share this builder so their behaviour is byte-for-byte identical:
 *
 *  1. The (now-deprecated) standalone `autonomous-agents.ask(question, …)` in
 *     `actions.ts`, which delegates here.
 *  2. The Agent-as-Worker dispatcher attached by `agentAsWorker` in
 *     `worker.ts`, which `digital-workers.ask(agentWorker, question, …)`
 *     routes to.
 *
 * Because both paths build the `generateObject` arguments through
 * {@link buildAskGenerateOptions}, the parity snapshot test in
 * `test/ask-parity.test.ts` can assert that
 * `digital-workers.ask(agent, q)` produces the SAME prompt + schema as the
 * prior `autonomous-agents.ask(q)` did. PRD: route Layer 5 through
 * digital-workers (aip-qozi).
 *
 * @packageDocumentation
 */

import { generateObject, type AIGenerateOptions, type SimpleSchema } from 'ai-functions'

/**
 * The default response schema used by `ask` when the caller supplies none.
 * Matches the historical `autonomous-agents.ask` schema exactly.
 */
export const DEFAULT_ASK_SCHEMA: SimpleSchema = {
  answer: 'The answer to the question',
  reasoning: 'Supporting reasoning',
}

/**
 * The default system prompt used by `ask` when the caller supplies none.
 * Matches the historical `autonomous-agents.ask` system prompt exactly.
 */
export const DEFAULT_ASK_SYSTEM =
  'You are a knowledgeable AI assistant. Provide clear, accurate answers.'

/**
 * Build the exact `generateObject` arguments the historical
 * `autonomous-agents.ask` produced.
 *
 * This is the parity-critical construction. Do not change the shape without
 * updating the snapshot test — it guards the migration of every prior
 * `autonomous-agents.ask` callsite onto `digital-workers.ask`.
 *
 * @param question - The question to ask.
 * @param context - Optional context, serialized into the prompt.
 * @param options - Optional generation overrides (model / schema / system /
 *   temperature), matching the prior `ask` signature.
 */
export function buildAskGenerateOptions(
  question: string,
  context?: unknown,
  options?: AIGenerateOptions
): {
  model: string
  schema: SimpleSchema
  system: string
  prompt: string
  temperature: number
} {
  return {
    model: options?.model || 'sonnet',
    schema: (options?.schema as SimpleSchema) || DEFAULT_ASK_SCHEMA,
    system: options?.system || DEFAULT_ASK_SYSTEM,
    prompt: `Question: ${question}\n\nContext: ${JSON.stringify(context || {})}`,
    temperature: options?.temperature ?? 0.7,
  }
}

/**
 * Run the parity-preserving `ask` and return the agent's answer.
 *
 * Shared by the deprecated standalone `ask` and the Agent-as-Worker
 * dispatcher. Returns the `answer` field of the generated object (the prior
 * `autonomous-agents.ask` contract).
 */
export async function runAsk<TResult = unknown>(
  question: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  const result = await generateObject(buildAskGenerateOptions(question, context, options))
  const response = result.object as { answer: TResult; reasoning: string }
  return response.answer
}
