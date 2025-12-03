/**
 * AI Generation functions with automatic model resolution and routing
 *
 * Wraps AI SDK generateObject and generateText with smart model routing:
 * - Simple aliases: 'opus', 'sonnet', 'gpt-4o'
 * - Full IDs: 'anthropic/claude-sonnet-4.5'
 * - Auto-routes to native SDKs for openai/anthropic/google
 *
 * @packageDocumentation
 */

import {
  generateObject as sdkGenerateObject,
  generateText as sdkGenerateText,
  streamObject as sdkStreamObject,
  streamText as sdkStreamText,
  type GenerateObjectResult,
  type GenerateTextResult,
  type StreamObjectResult,
  type StreamTextResult,
  type LanguageModel
} from 'ai'
import { schema as convertSchema, type SimpleSchema } from './schema.js'
import type { ZodTypeAny } from 'zod'

type ModelArg = string | LanguageModel
type SchemaArg = ZodTypeAny | SimpleSchema

interface GenerateObjectOptions<T> {
  model: ModelArg
  schema: T
  prompt?: string
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  system?: string
  mode?: 'auto' | 'json' | 'tool'
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  seed?: number
  maxRetries?: number
  abortSignal?: AbortSignal
  headers?: Record<string, string>
  experimental_telemetry?: { isEnabled?: boolean; functionId?: string; metadata?: Record<string, string> }
}

interface GenerateTextOptions {
  model: ModelArg
  prompt?: string
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  system?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  seed?: number
  maxRetries?: number
  abortSignal?: AbortSignal
  headers?: Record<string, string>
  tools?: Record<string, unknown>
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }
  maxSteps?: number
  experimental_telemetry?: { isEnabled?: boolean; functionId?: string; metadata?: Record<string, string> }
}

/**
 * Resolve model string to LanguageModel instance
 */
async function resolveModel(modelArg: ModelArg): Promise<LanguageModel> {
  // Already a LanguageModel instance
  if (typeof modelArg !== 'string') {
    return modelArg
  }

  // Import model router from ai-providers
  const { model } = await import('ai-providers')
  return model(modelArg)
}

/**
 * Check if value is a Zod schema
 */
function isZodSchema(value: unknown): value is ZodTypeAny {
  return value !== null &&
    typeof value === 'object' &&
    '_def' in value &&
    'parse' in value
}

/**
 * Convert schema to Zod if needed
 */
function resolveSchema(schemaArg: SchemaArg): ZodTypeAny {
  if (isZodSchema(schemaArg)) {
    return schemaArg
  }
  return convertSchema(schemaArg as SimpleSchema)
}

/**
 * Generate a typed object from a prompt using AI
 *
 * Automatically resolves model aliases and routes to the best provider.
 * Supports both Zod schemas and simplified schema syntax.
 *
 * @example
 * ```ts
 * import { generateObject } from 'ai-functions'
 *
 * // Simplified schema syntax
 * const { object } = await generateObject({
 *   model: 'sonnet',
 *   schema: {
 *     recipe: {
 *       name: 'What is the recipe name?',
 *       type: 'food | drink | dessert',
 *       ingredients: ['List all ingredients'],
 *       steps: ['List all cooking steps'],
 *     },
 *   },
 *   prompt: 'Generate a lasagna recipe.',
 * })
 *
 * // Zod schema also works
 * import { z } from 'zod'
 * const { object } = await generateObject({
 *   model: 'sonnet',
 *   schema: z.object({
 *     name: z.string(),
 *     ingredients: z.array(z.string()),
 *   }),
 *   prompt: 'Generate a lasagna recipe.',
 * })
 * ```
 */
export async function generateObject<T>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<T>> {
  const model = await resolveModel(options.model)
  const schema = resolveSchema(options.schema as SchemaArg)
  return sdkGenerateObject({
    ...options,
    model,
    schema
  } as Parameters<typeof sdkGenerateObject>[0]) as Promise<GenerateObjectResult<T>>
}

/**
 * Generate text from a prompt using AI
 *
 * Automatically resolves model aliases and routes to the best provider.
 *
 * @example
 * ```ts
 * import { generateText } from 'ai-functions'
 *
 * const { text } = await generateText({
 *   model: 'opus',  // → anthropic/claude-opus-4.5
 *   prompt: 'Write a haiku about programming.',
 * })
 *
 * // With tools
 * const { text, toolResults } = await generateText({
 *   model: 'gpt-4o',  // → openai/gpt-4o
 *   prompt: 'What is the weather in San Francisco?',
 *   tools: { ... },
 *   maxSteps: 5,
 * })
 * ```
 */
export async function generateText(
  options: GenerateTextOptions
): Promise<GenerateTextResult<Record<string, unknown>, never>> {
  const model = await resolveModel(options.model)
  return sdkGenerateText({
    ...options,
    model
  } as Parameters<typeof sdkGenerateText>[0])
}

/**
 * Stream a typed object from a prompt using AI
 *
 * @example
 * ```ts
 * import { streamObject } from 'ai-functions'
 *
 * const { partialObjectStream } = streamObject({
 *   model: 'sonnet',
 *   schema: { story: 'Write a creative story' },
 *   prompt: 'Write a short story.',
 * })
 *
 * for await (const partial of partialObjectStream) {
 *   console.log(partial.story)
 * }
 * ```
 */
export async function streamObject<T>(
  options: GenerateObjectOptions<T>
): Promise<StreamObjectResult<T, never, never>> {
  const model = await resolveModel(options.model)
  const schema = resolveSchema(options.schema as SchemaArg)
  return sdkStreamObject({
    ...options,
    model,
    schema
  } as Parameters<typeof sdkStreamObject>[0]) as Promise<StreamObjectResult<T, never, never>>
}

/**
 * Stream text from a prompt using AI
 *
 * @example
 * ```ts
 * import { streamText } from 'ai-functions'
 *
 * const { textStream } = streamText({
 *   model: 'gemini',  // → google/gemini-2.5-flash
 *   prompt: 'Explain quantum computing.',
 * })
 *
 * for await (const chunk of textStream) {
 *   process.stdout.write(chunk)
 * }
 * ```
 */
export async function streamText(
  options: GenerateTextOptions
): Promise<StreamTextResult<Record<string, unknown>, never>> {
  const model = await resolveModel(options.model)
  return sdkStreamText({
    ...options,
    model
  } as Parameters<typeof sdkStreamText>[0])
}
