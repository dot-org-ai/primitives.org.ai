/**
 * Content generation functionality for digital workers
 *
 * IMPORTANT: Worker-Context Generation vs Direct LLM Generation
 * --------------------------------------------------------------
 * This module provides content generation within a worker context,
 * with rich metadata about the generation process.
 *
 * - `digital-workers.generate()` - Generates content with full metadata
 *   (tokens used, duration, model info) and supports multiple content types
 *   including text, code, structured, image, video, and audio.
 *
 * - `ai-functions.generate()` - Core generation primitive that powers all
 *   ai-functions; lower-level function with type-based dispatch.
 *
 * The key difference is context and metadata:
 * - digital-workers returns `GenerateResult<T>` with content + metadata
 * - ai-functions returns just the generated content
 *
 * Use digital-workers when you need:
 * - Rich metadata about generation (tokens, duration, model)
 * - Content type variants (text, code, structured, media)
 * - Tone, audience, and length modifiers
 * - Iterative refinement workflows
 *
 * Use ai-functions when you need:
 * - Direct LLM generation without metadata
 * - Template literal syntax (`ai\`prompt\``)
 * - Promise pipelining and schema inference
 *
 * @module
 */

import { generateObject, generateText } from 'ai-functions'
import type { SimpleSchema } from 'ai-functions'
import type { GenerateResult, GenerateOptions } from './types.js'

/**
 * Generate content with rich metadata and multiple content type support.
 *
 * **Key Difference from ai-functions.generate():**
 * Unlike `ai-functions.generate()` which is a lower-level type-dispatch
 * function, this function returns a `GenerateResult` wrapper with:
 * - The generated content
 * - Generation metadata (model, tokens, duration)
 * - Content type information
 *
 * This provides better observability for worker-based content generation.
 *
 * @param prompt - What to generate
 * @param options - Generation options (type, schema, instructions, model)
 * @returns Promise resolving to GenerateResult with content and metadata
 *
 * @example
 * ```ts
 * // Generate text content with metadata
 * const result = await generate('Write a product description for wireless earbuds', {
 *   type: 'text',
 *   instructions: 'Focus on sound quality and battery life. Keep it under 100 words.',
 * })
 * console.log(result.content) // The generated text
 * console.log(result.metadata.tokens) // Tokens used
 * console.log(result.metadata.duration) // Generation time in ms
 * ```
 *
 * @example
 * ```ts
 * // Generate structured data
 * const result = await generate('Create a user profile', {
 *   type: 'structured',
 *   schema: {
 *     name: 'User full name',
 *     email: 'Email address',
 *     role: 'admin | user | guest',
 *     preferences: {
 *       theme: 'light | dark',
 *       notifications: 'Whether to receive notifications (boolean)',
 *     },
 *   },
 * })
 * console.log(result.content) // { name: '...', email: '...', ... }
 * ```
 *
 * @example
 * ```ts
 * // Generate code
 * const result = await generate('Create a React component for a todo list', {
 *   type: 'code',
 *   instructions: 'Use TypeScript and hooks. Include prop types.',
 * })
 * console.log(result.content) // TypeScript React component code
 * console.log(result.metadata.language) // 'typescript'
 * ```
 *
 * @see {@link ai-functions#generate} for lower-level type-dispatch generation
 * @see {@link ai-functions#ai} for template literal generation syntax
 */
export async function generate<T = string>(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult<T>> {
  const { type = 'text', schema, instructions, model = 'sonnet' } = options

  const startTime = Date.now()

  switch (type) {
    case 'text': {
      const systemPrompt = instructions
        ? `You are an expert content generator. ${instructions}`
        : 'You are an expert content generator.'

      const result = await generateText({
        model,
        prompt,
        system: systemPrompt,
      })

      return {
        content: result.text as T,
        type: 'text',
        metadata: {
          model,
          tokens: result.usage?.totalTokens,
          duration: Date.now() - startTime,
        },
      }
    }

    case 'structured': {
      if (!schema) {
        throw new Error('Schema is required for structured content generation')
      }

      const systemPrompt = instructions
        ? `You are an expert at generating structured data. ${instructions}`
        : 'You are an expert at generating structured data.'

      const result = await generateObject({
        model,
        schema,
        prompt,
        system: systemPrompt,
      })

      return {
        content: result.object as T,
        type: 'structured',
        metadata: {
          model,
          tokens: (result.usage as { totalTokens?: number } | undefined)?.totalTokens,
          duration: Date.now() - startTime,
        },
      }
    }

    case 'code': {
      const systemPrompt = instructions
        ? `You are an expert programmer. Generate clean, well-documented code. ${instructions}`
        : 'You are an expert programmer. Generate clean, well-documented code.'

      const result = await generateObject({
        model,
        schema: {
          code: 'The generated code',
          language: 'Programming language used',
          explanation: 'Brief explanation of the code',
        },
        prompt,
        system: systemPrompt,
      })

      const codeResult = result.object as {
        code: string
        language: string
        explanation: string
      }

      return {
        content: codeResult.code as T,
        type: 'code',
        metadata: {
          model,
          tokens: (result.usage as { totalTokens?: number } | undefined)?.totalTokens,
          duration: Date.now() - startTime,
          language: codeResult.language,
          explanation: codeResult.explanation,
        },
      }
    }

    case 'image': {
      // Image generation would integrate with image generation APIs
      // For now, return a placeholder
      throw new Error('Image generation not yet implemented')
    }

    case 'video': {
      // Video generation would integrate with video generation APIs
      throw new Error('Video generation not yet implemented')
    }

    case 'audio': {
      // Audio generation would integrate with audio generation APIs
      throw new Error('Audio generation not yet implemented')
    }

    default:
      throw new Error(`Unknown content type: ${type}`)
  }
}

/**
 * Generate multiple variations of content
 *
 * @param prompt - What to generate
 * @param count - Number of variations to generate
 * @param options - Generation options
 * @returns Promise resolving to array of generated content
 *
 * @example
 * ```ts
 * const variations = await generate.variations(
 *   'Write a catchy headline for a coffee shop',
 *   5,
 *   { type: 'text' }
 * )
 *
 * variations.forEach((v, i) => {
 *   console.log(`${i + 1}. ${v.content}`)
 * })
 * ```
 */
generate.variations = async <T = string>(
  prompt: string,
  count: number,
  options: GenerateOptions = {}
): Promise<Array<GenerateResult<T>>> => {
  return Promise.all(Array.from({ length: count }, () => generate<T>(prompt, options)))
}

/**
 * Generate content with a specific tone
 *
 * @param prompt - What to generate
 * @param tone - The desired tone
 * @param options - Generation options
 * @returns Promise resolving to generated content
 *
 * @example
 * ```ts
 * const professional = await generate.withTone(
 *   'Write an email declining a meeting',
 *   'professional',
 *   { type: 'text' }
 * )
 *
 * const friendly = await generate.withTone(
 *   'Write an email declining a meeting',
 *   'friendly',
 *   { type: 'text' }
 * )
 * ```
 */
generate.withTone = async <T = string>(
  prompt: string,
  tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'humorous' | 'empathetic',
  options: GenerateOptions = {}
): Promise<GenerateResult<T>> => {
  const toneInstructions = {
    professional: 'Use a professional, business-appropriate tone.',
    casual: 'Use a casual, conversational tone.',
    friendly: 'Use a warm, friendly tone.',
    formal: 'Use a formal, ceremonious tone.',
    humorous: 'Use a light, humorous tone.',
    empathetic: 'Use an empathetic, understanding tone.',
  }

  return generate<T>(prompt, {
    ...options,
    instructions: `${toneInstructions[tone]} ${options.instructions || ''}`,
  })
}

/**
 * Generate content for a specific audience
 *
 * @param prompt - What to generate
 * @param audience - Target audience
 * @param options - Generation options
 * @returns Promise resolving to generated content
 *
 * @example
 * ```ts
 * const technical = await generate.forAudience(
 *   'Explain how OAuth works',
 *   'software engineers',
 *   { type: 'text' }
 * )
 *
 * const nonTechnical = await generate.forAudience(
 *   'Explain how OAuth works',
 *   'non-technical business users',
 *   { type: 'text' }
 * )
 * ```
 */
generate.forAudience = async <T = string>(
  prompt: string,
  audience: string,
  options: GenerateOptions = {}
): Promise<GenerateResult<T>> => {
  return generate<T>(prompt, {
    ...options,
    instructions: `Write for ${audience}. ${options.instructions || ''}`,
  })
}

/**
 * Generate content with specific length
 *
 * @param prompt - What to generate
 * @param length - Desired length
 * @param options - Generation options
 * @returns Promise resolving to generated content
 *
 * @example
 * ```ts
 * const short = await generate.withLength(
 *   'Describe our company',
 *   'short',
 *   { type: 'text' }
 * )
 *
 * const detailed = await generate.withLength(
 *   'Describe our company',
 *   'detailed',
 *   { type: 'text' }
 * )
 * ```
 */
generate.withLength = async <T = string>(
  prompt: string,
  length: 'brief' | 'short' | 'medium' | 'long' | 'detailed',
  options: GenerateOptions = {}
): Promise<GenerateResult<T>> => {
  const lengthInstructions = {
    brief: 'Keep it very brief - 1-2 sentences maximum.',
    short: 'Keep it short - around 50-100 words.',
    medium: 'Use a medium length - around 150-300 words.',
    long: 'Write a longer piece - around 400-600 words.',
    detailed: 'Write a detailed, comprehensive piece - 800+ words.',
  }

  return generate<T>(prompt, {
    ...options,
    instructions: `${lengthInstructions[length]} ${options.instructions || ''}`,
  })
}

/**
 * Generate content by iteratively refining it
 *
 * @param prompt - What to generate
 * @param refinements - Refinement prompts to apply
 * @param options - Generation options
 * @returns Promise resolving to refined content
 *
 * @example
 * ```ts
 * const refined = await generate.refine(
 *   'Write a product tagline',
 *   [
 *     'Make it more memorable',
 *     'Add a sense of urgency',
 *     'Emphasize the value proposition',
 *   ],
 *   { type: 'text' }
 * )
 * ```
 */
generate.refine = async <T = string>(
  prompt: string,
  refinements: string[],
  options: GenerateOptions = {}
): Promise<GenerateResult<T>> => {
  // Generate initial content
  let result = await generate<T>(prompt, options)

  // Apply refinements iteratively
  for (const refinement of refinements) {
    result = await generate<T>(
      `Refine the following content: ${result.content}\n\nRefinement: ${refinement}`,
      options
    )
  }

  return result
}
