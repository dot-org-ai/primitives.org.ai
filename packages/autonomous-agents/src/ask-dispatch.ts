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

// ============================================================================
// LLM-shape Verbs (PRD aip-2q19) — shared parity builders for do / decide /
// generate / is. Each `build*GenerateOptions` matches the prior
// `autonomous-agents.actions.ts` implementation byte-for-byte so the
// `<verb>-parity.test.ts` snapshot tests pass.
// ============================================================================

// ---- do --------------------------------------------------------------------

/** Default schema for `do` — matches `autonomous-agents.actions.doAction`. */
export const DEFAULT_DO_SCHEMA: SimpleSchema = { result: 'The result of the task' }

/** Default system prompt for `do` — matches `actions.doAction`. */
export const DEFAULT_DO_SYSTEM =
  'You are a helpful AI assistant. Execute tasks accurately and thoroughly.'

/**
 * Build the exact `generateObject` arguments the historical
 * `autonomous-agents.doAction` produced.
 */
export function buildDoGenerateOptions(
  task: string,
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
    schema: (options?.schema as SimpleSchema) || DEFAULT_DO_SCHEMA,
    system: options?.system || DEFAULT_DO_SYSTEM,
    prompt: `Task: ${task}\n\nContext: ${JSON.stringify(context || {})}`,
    temperature: options?.temperature ?? 0.7,
  }
}

/**
 * Run the parity-preserving `do` and return the agent's result. Matches the
 * historical `autonomous-agents.doAction` contract — return value is
 * `obj.result ?? obj` from `generateObject`.
 */
export async function runDo<TResult = unknown>(
  task: string,
  context?: unknown,
  options?: AIGenerateOptions
): Promise<TResult> {
  const result = await generateObject(buildDoGenerateOptions(task, context, options))
  return (result.object as { result: TResult }).result || (result.object as TResult)
}

// ---- decide ----------------------------------------------------------------

/** Default system prompt for `decide` — matches `actions.decide`. */
export const DEFAULT_DECIDE_SYSTEM =
  'You are a strategic decision-maker. Evaluate options carefully and provide clear reasoning.'

/**
 * Build the exact `generateObject` arguments the historical
 * `autonomous-agents.decide` produced.
 *
 * The schema embeds the option union into the `decision` field exactly as
 * the prior implementation did.
 */
export function buildDecideGenerateOptions<T extends string>(
  options: T[],
  context?: string,
  settings?: AIGenerateOptions
): {
  model: string
  schema: SimpleSchema
  system: string
  prompt: string
  temperature: number
} {
  return {
    model: settings?.model || 'sonnet',
    schema: {
      decision: options.join(' | '),
      reasoning: 'Reasoning for this decision',
      confidence: 'Confidence level 0-100 (number)',
    } as SimpleSchema,
    system: settings?.system || DEFAULT_DECIDE_SYSTEM,
    prompt: `Make a decision between these options:\n${options
      .map((o, i) => `${i + 1}. ${o}`)
      .join('\n')}\n\nContext: ${context || 'No additional context'}`,
    temperature: settings?.temperature ?? 0.7,
  }
}

/**
 * Run the parity-preserving `decide` and return the chosen option.
 */
export async function runDecide<T extends string>(
  options: T[],
  context?: string,
  settings?: AIGenerateOptions
): Promise<T> {
  const result = await generateObject(buildDecideGenerateOptions(options, context, settings))
  const response = result.object as unknown as {
    decision: T
    reasoning: string
    confidence: number
  }
  return response.decision
}

// ---- generate --------------------------------------------------------------

/** Default schema for `generate` — matches `actions.generate`. */
export const DEFAULT_GENERATE_SCHEMA: SimpleSchema = { result: 'Generated content' }

/** Default system prompt for `generate` — matches `actions.generate`. */
export const DEFAULT_GENERATE_SYSTEM =
  'You are a creative AI assistant. Generate high-quality content.'

/**
 * Build the exact `generateObject` arguments the historical
 * `autonomous-agents.generate` produced.
 */
export function buildGenerateGenerateOptions(options: AIGenerateOptions): {
  model: string
  schema: SimpleSchema
  system: string
  prompt: string
  temperature: number
} {
  return {
    model: options.model || 'sonnet',
    schema: (options.schema || DEFAULT_GENERATE_SCHEMA) as SimpleSchema,
    system: options.system || DEFAULT_GENERATE_SYSTEM,
    prompt: options.prompt || '',
    temperature: options.temperature ?? 0.8,
  }
}

/**
 * Run the parity-preserving `generate` and return the full object.
 */
export async function runGenerate<TResult = unknown>(options: AIGenerateOptions): Promise<TResult> {
  const result = await generateObject(buildGenerateGenerateOptions(options))
  return result.object as TResult
}

// ---- is --------------------------------------------------------------------

/** Default system prompt for `is` — matches `actions.is`. */
export const DEFAULT_IS_SYSTEM =
  'You are a type validator. Determine if the value matches the expected type or schema.'

/**
 * Build the exact `generateObject` arguments the historical
 * `autonomous-agents.is` produced.
 */
export function buildIsGenerateOptions(
  value: unknown,
  type: string | SimpleSchema
): {
  model: string
  schema: SimpleSchema
  system: string
  prompt: string
  temperature: number
} {
  const schema =
    typeof type === 'string'
      ? { isValid: `Is this value a valid ${type}? (boolean)`, reason: 'Explanation' }
      : { isValid: 'Does this value match the schema? (boolean)', reason: 'Explanation' }

  return {
    model: 'sonnet',
    schema,
    system: DEFAULT_IS_SYSTEM,
    prompt: `Value: ${JSON.stringify(value)}\n\nExpected type: ${
      typeof type === 'string' ? type : JSON.stringify(type)
    }`,
    temperature: 0,
  }
}

/**
 * Run the parity-preserving `is` and return the boolean validity.
 */
export async function runIs(value: unknown, type: string | SimpleSchema): Promise<boolean> {
  const result = await generateObject(buildIsGenerateOptions(value, type))
  return (result.object as unknown as { isValid: boolean; reason: string }).isValid
}
