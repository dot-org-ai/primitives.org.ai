/**
 * AI Function Primitives with Promise Pipelining
 *
 * All functions return AIPromise for:
 * - Dynamic schema inference from destructuring
 * - Promise pipelining without await
 * - Magical .map() for batch processing
 * - Dependency graph resolution
 *
 * @example
 * ```ts
 * // No await needed until the end!
 * const { summary, keyPoints, conclusion } = ai`write about ${topic}`
 * const isValid = is`${conclusion} is solid given ${keyPoints}`
 * const improved = ai`improve ${conclusion} using ${keyPoints}`
 *
 * // Batch processing with map
 * const ideas = list`startup ideas`
 * const evaluated = await ideas.map(idea => ({
 *   idea,
 *   viable: is`${idea} is viable`,
 *   market: ai`market size for ${idea}`,
 * }))
 *
 * // Only await at the end
 * if (await isValid) {
 *   console.log(await improved)
 * }
 * ```
 *
 * @packageDocumentation
 */

import {
  AIPromise,
  createAITemplateFunction,
  parseTemplateWithDependencies,
  isAIPromise,
} from './ai-promise.js'
import { generateObject, generateText } from './generate.js'
import type { SimpleSchema } from './schema.js'
import type { HumanChannel } from './types.js'

// ============================================================================
// Types
// ============================================================================

export type GenerateType =
  | 'text'
  | 'json'
  | 'code'
  | 'list'
  | 'lists'
  | 'markdown'
  | 'yaml'
  | 'diagram'
  | 'slides'
  | 'boolean'
  | 'summary'
  | 'extract'

export interface GenerateOptions {
  /** Model to use */
  model?: string
  /** System prompt */
  system?: string
  /** Temperature (0-2) */
  temperature?: number
  /** Max tokens */
  maxTokens?: number
  /** Schema for JSON output */
  schema?: SimpleSchema
  /** Language for code generation */
  language?: string
  /** Format for diagrams */
  format?: 'mermaid' | 'svg' | 'ascii'
  /** Number of slides for presentations */
  slides?: number
}

// ============================================================================
// Core generate() primitive
// ============================================================================

/**
 * Core generate primitive - all other functions use this under the hood
 */
export async function generate(
  type: GenerateType,
  prompt: string,
  options?: GenerateOptions
): Promise<unknown> {
  const { model = 'sonnet', schema, language, format, slides: slideCount, ...rest } = options || {}

  switch (type) {
    case 'text':
    case 'markdown':
      return generateTextContent(prompt, model, rest)
    case 'json':
      return generateJsonContent(prompt, model, schema, rest)
    case 'code':
      return generateCodeContent(prompt, model, language || 'typescript', rest)
    case 'list':
      return generateListContent(prompt, model, rest)
    case 'lists':
      return generateListsContent(prompt, model, rest)
    case 'boolean':
      return generateBooleanContent(prompt, model, rest)
    case 'summary':
      return generateSummaryContent(prompt, model, rest)
    case 'extract':
      return generateExtractContent(prompt, model, schema, rest)
    case 'yaml':
      return generateYamlContent(prompt, model, rest)
    case 'diagram':
      return generateDiagramContent(prompt, model, format || 'mermaid', rest)
    case 'slides':
      return generateSlidesContent(prompt, model, slideCount || 10, rest)
    default:
      throw new Error(`Unknown generate type: ${type}`)
  }
}

// Helper functions
async function generateTextContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string> {
  const result = await generateText({
    model,
    prompt,
    ...(options.system !== undefined && { system: options.system }),
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return result.text
}

async function generateJsonContent(
  prompt: string,
  model: string,
  schema: SimpleSchema | undefined,
  options: GenerateOptions
): Promise<unknown> {
  const effectiveSchema = schema || { result: 'The generated result' }
  const result = await generateObject({
    model,
    schema: effectiveSchema,
    prompt,
    ...(options.system !== undefined && { system: options.system }),
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return result.object
}

async function generateCodeContent(
  prompt: string,
  model: string,
  language: string,
  options: GenerateOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { code: `The ${language} implementation code` },
    prompt: `Generate ${language} code for: ${prompt}`,
    system: `You are an expert ${language} developer. Generate clean, well-documented code.`,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { code: string }).code
}

async function generateListContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string[]> {
  const result = await generateObject({
    model,
    schema: { items: ['List items'] },
    prompt,
    system: options.system || 'Generate a list of items based on the prompt.',
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { items: string[] }).items
}

async function generateListsContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<Record<string, string[]>> {
  const result = await generateObject({
    model,
    schema: {
      categories: ['Category names as strings'],
      data: 'JSON string containing the categorized lists',
    },
    prompt: `Generate categorized lists for: ${prompt}\n\nFirst identify appropriate category names, then provide the lists as a JSON object.`,
    system:
      options.system ||
      'Generate multiple categorized lists. Determine appropriate categories based on the prompt.',
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  const obj = result.object as { categories: string[]; data: string }
  try {
    return JSON.parse(obj.data) as Record<string, string[]>
  } catch {
    const lists: Record<string, string[]> = {}
    for (const cat of obj.categories || []) {
      lists[cat] = []
    }
    return lists
  }
}

async function generateBooleanContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<boolean> {
  const result = await generateObject({
    model,
    schema: { answer: 'true | false' },
    prompt,
    system: options.system || 'Answer the question with true or false.',
    temperature: options.temperature ?? 0,
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { answer: string }).answer === 'true'
}

async function generateSummaryContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { summary: 'A concise summary of the content' },
    prompt: `Summarize the following:\n\n${prompt}`,
    system: options.system || 'Create a clear, concise summary.',
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { summary: string }).summary
}

async function generateExtractContent(
  prompt: string,
  model: string,
  schema: SimpleSchema | undefined,
  options: GenerateOptions
): Promise<unknown[]> {
  const effectiveSchema = schema || {
    items: ['Array of extracted items as strings - extract ALL matching items from the text'],
  }
  const result = await generateObject({
    model,
    schema: effectiveSchema,
    prompt: `Extract the following from the text below. Return ALL matching items in the items array.

Task: ${prompt}

IMPORTANT: Return the extracted items as an array. If the task asks for email addresses, return all email addresses found. If it asks for names, return all names found. Do not return an empty array if there are items to extract.`,
    system:
      options.system ||
      'You are a precise data extraction assistant. Extract exactly what is requested and return it as an array of items. Be thorough - find ALL matching items in the text.',
    temperature: options.temperature ?? 0, // Use low temperature for extraction tasks
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  const obj = result.object as Record<string, unknown>
  if ('items' in obj && Array.isArray(obj['items'])) {
    return obj['items']
  }
  return Object.values(obj).flat() as unknown[]
}

async function generateYamlContent(
  prompt: string,
  model: string,
  options: GenerateOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { yaml: 'The YAML content' },
    prompt: `Generate YAML for: ${prompt}`,
    system: options.system || 'Generate valid YAML content.',
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { yaml: string }).yaml
}

async function generateDiagramContent(
  prompt: string,
  model: string,
  format: string,
  options: GenerateOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { diagram: `The ${format} diagram code` },
    prompt: `Generate a ${format} diagram for: ${prompt}`,
    system: options.system || `Generate ${format} diagram syntax.`,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { diagram: string }).diagram
}

async function generateSlidesContent(
  prompt: string,
  model: string,
  slideCount: number,
  options: GenerateOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { slides: `Slidev/Marp markdown with ${slideCount} slides` },
    prompt: `Generate a ${slideCount}-slide presentation about: ${prompt}`,
    system: options.system || 'Generate markdown slides in Slidev/Marp format.',
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  })
  return (result.object as { slides: string }).slides
}

// ============================================================================
// AIPromise-based Functions
// ============================================================================

/**
 * General-purpose AI function with dynamic schema inference
 *
 * @example
 * ```ts
 * // Simple text generation
 * const text = await ai`write a poem about ${topic}`
 *
 * // Dynamic schema from destructuring - no await needed!
 * const { summary, keyPoints, conclusion } = ai`write about ${topic}`
 * console.log(await summary)
 *
 * // Chain with other functions
 * const isValid = is`${conclusion} is solid`
 * const improved = ai`improve ${conclusion}`
 * ```
 */
export const ai = createAITemplateFunction<unknown>('object')

/**
 * Generate text content
 *
 * @example
 * ```ts
 * const post = await write`blog post about ${topic}`
 * ```
 */
export const write = createAITemplateFunction<string>('text')

/**
 * Generate code
 *
 * @example
 * ```ts
 * const code = await code`email validation function`
 * ```
 */
export const code = createAITemplateFunction<string>('text', {
  system: 'You are an expert programmer. Generate clean, well-documented code.',
})

/**
 * Generate a list of items with .map() support
 *
 * @example
 * ```ts
 * // Simple list
 * const ideas = await list`startup ideas`
 *
 * // With map - batch processes in ONE call!
 * const evaluated = await list`startup ideas`.map(idea => ({
 *   idea,
 *   viable: is`${idea} is viable`,
 *   market: ai`market size for ${idea}`,
 * }))
 *
 * // Async iteration
 * for await (const idea of list`startup ideas`) {
 *   console.log(idea)
 * }
 * ```
 */
export const list = createAITemplateFunction<string[]>('list')

/**
 * Generate multiple named lists with dynamic schema
 *
 * @example
 * ```ts
 * // Destructuring infers the schema!
 * const { pros, cons } = await lists`pros and cons of ${topic}`
 *
 * // No await - pipeline with other functions
 * const { benefits, risks, costs } = lists`analysis of ${project}`
 * const summary = ai`summarize: benefits=${benefits}, risks=${risks}`
 * console.log(await summary)
 * ```
 */
export const lists = createAITemplateFunction<Record<string, string[]>>('lists')

/**
 * Extract structured data with dynamic schema
 *
 * @example
 * ```ts
 * // Dynamic schema from destructuring
 * const { name, email, phone } = await extract`contact info from ${document}`
 *
 * // As array
 * const emails = await extract`email addresses from ${text}`
 * ```
 */
export const extract = createAITemplateFunction<unknown[]>('extract')

/**
 * Summarize text
 *
 * @example
 * ```ts
 * const summary = await summarize`${longArticle}`
 * ```
 */
export const summarize = createAITemplateFunction<string>('text', {
  system: 'Create a clear, concise summary.',
})

/**
 * Check if something is true/false
 *
 * @example
 * ```ts
 * // Simple check
 * const isColor = await is`${topic} a color`
 *
 * // Pipeline - no await needed!
 * const { conclusion } = ai`write about ${topic}`
 * const isValid = is`${conclusion} is well-argued`
 * if (await isValid) { ... }
 * ```
 */
export const is = createAITemplateFunction<boolean>('boolean')

/**
 * Generate a diagram
 *
 * @example
 * ```ts
 * const diagram = await diagram`user authentication flow`
 * ```
 */
export const diagram = createAITemplateFunction<string>('text', {
  system: 'Generate a Mermaid diagram.',
})

/**
 * Generate presentation slides
 *
 * @example
 * ```ts
 * const slides = await slides`quarterly review`
 * ```
 */
export const slides = createAITemplateFunction<string>('text', {
  system: 'Generate markdown slides in Slidev/Marp format.',
})

/**
 * Generate an image
 */
export const image = createAITemplateFunction<Buffer>('text')

/**
 * Generate a video
 */
export const video = createAITemplateFunction<Buffer>('text')

// ============================================================================
// Agentic Functions
// ============================================================================

/**
 * Execute a task
 *
 * @example
 * ```ts
 * const { summary, actions } = await do`send welcome email to ${user}`
 * ```
 */
function doImpl(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): AIPromise<{ summary: string; actions: string[] }> {
  let prompt: string
  let dependencies: { promise: AIPromise<unknown>; path: string[] }[] = []

  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    const parsed = parseTemplateWithDependencies(promptOrStrings, ...args)
    prompt = parsed.prompt
    dependencies = parsed.dependencies
  } else {
    prompt = promptOrStrings as string
  }

  const promise = new AIPromise<{ summary: string; actions: string[] }>(prompt, {
    type: 'object',
    baseSchema: {
      summary: 'Summary of what was done',
      actions: ['List of actions taken'],
    },
    system: 'You are a task executor. Describe what actions you would take.',
  })

  for (const dep of dependencies) {
    promise.addDependency(dep.promise, dep.path)
  }

  return promise
}

export { doImpl as do }

/**
 * Conduct research on a topic
 *
 * @example
 * ```ts
 * const { summary, findings, sources } = await research`${competitor} vs our product`
 * ```
 */
export const research = createAITemplateFunction<{
  summary: string
  findings: string[]
  sources: string[]
}>('object', {
  system: 'You are a research analyst. Provide thorough research.',
})

// ============================================================================
// Web Functions
// ============================================================================

/**
 * Read a URL and convert to markdown
 */
export const read = createAITemplateFunction<string>('text')

/**
 * Browse a URL with browser automation
 *
 * @experimental This function is experimental and returns mock data.
 * The actual implementation will use Stagehand or Playwright for browser automation.
 * Do not rely on this function in production code until it is fully implemented.
 *
 * @param urlOrStrings - URL string or template literal
 * @param args - Template literal values
 * @returns Browser automation interface with do, extract, screenshot, and close methods
 *
 * @example
 * ```ts
 * const browser = await browse`https://example.com`
 * await browser.do('click the login button')
 * const data = await browser.extract('user profile information')
 * const screenshot = await browser.screenshot()
 * await browser.close()
 * ```
 */
export async function browse(
  urlOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<{
  do: (action: string) => Promise<void>
  extract: (query: string) => Promise<unknown>
  screenshot: () => Promise<Buffer>
  close: () => Promise<void>
}> {
  // EXPERIMENTAL: This is a placeholder implementation returning mock data.
  // Actual implementation would use Stagehand or Playwright for browser automation.
  return {
    do: async () => {},
    extract: async () => ({}),
    screenshot: async () => Buffer.from('screenshot'),
    close: async () => {},
  }
}

// ============================================================================
// Decision Functions
// ============================================================================

/**
 * LLM as judge - compare options and pick the best
 *
 * @example
 * ```ts
 * const winner = await decide`higher click-through rate`(headlineA, headlineB)
 * ```
 */
export function decide(
  criteriaOrStrings: string | TemplateStringsArray,
  ...templateArgs: unknown[]
): <T>(...options: T[]) => AIPromise<T> {
  let criteria: string

  if (Array.isArray(criteriaOrStrings) && 'raw' in criteriaOrStrings) {
    criteria = criteriaOrStrings.reduce((acc, str, i) => acc + str + (templateArgs[i] ?? ''), '')
  } else {
    criteria = criteriaOrStrings as string
  }

  return <T>(...options: T[]): AIPromise<T> => {
    const optionDescriptions = options
      .map((opt, i) => `Option ${i + 1}: ${JSON.stringify(opt)}`)
      .join('\n')

    const promise = new AIPromise<T>(
      `Given these options:\n${optionDescriptions}\n\nChoose the best option based on: ${criteria}`,
      {
        type: 'object',
        baseSchema: {
          chosenIndex: 'The index (1-based) of the best option as a number',
          reasoning: 'Brief explanation of why this option is best',
        },
      }
    )

    // Override resolve to return the actual option
    const originalResolve = promise.resolve.bind(promise)
    ;(promise as any).resolve = async () => {
      const result = (await originalResolve()) as { chosenIndex: string | number }
      const index =
        typeof result.chosenIndex === 'string'
          ? parseInt(result.chosenIndex, 10)
          : result.chosenIndex
      return options[index - 1] as T
    }

    return promise
  }
}

// ============================================================================
// Human-in-the-Loop Functions
// ============================================================================

export interface HumanOptions extends GenerateOptions {
  channel?: HumanChannel
  assignee?: string
  timeout?: number
  webhook?: string
}

export interface HumanResult<T = unknown> {
  pending: boolean
  requestId: string
  response?: T
  respondedBy?: string
  respondedAt?: Date
  artifacts?: {
    slackBlocks?: unknown[]
    emailHtml?: string
    webComponent?: string
    smsText?: string
  }
}

/**
 * Ask a human for input
 */
export const ask = createAITemplateFunction<HumanResult<string>>('object', {
  system: 'Generate content for human interaction.',
})

/**
 * Request human approval
 */
export const approve = createAITemplateFunction<HumanResult<{ approved: boolean; notes?: string }>>(
  'object',
  {
    system: 'Generate an approval request.',
  }
)

/**
 * Request human review
 */
export const review = createAITemplateFunction<
  HumanResult<{ rating?: number; feedback: string; approved?: boolean }>
>('object', {
  system: 'Generate a review request.',
})
