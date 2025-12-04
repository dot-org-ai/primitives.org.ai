/**
 * AI Function Primitives
 *
 * Core AI functions that all use generate() under the hood:
 * - Generative: ai, write, code, list, lists, extract, summarize, diagram, slides, image, video
 * - Agentic: do, research, browse
 * - Human: ask, approve
 * - Code: evaluate (via ai-sandbox)
 *
 * @packageDocumentation
 */

import {
  createTemplateFunction,
  createChainablePromise,
  createStreamableList,
  withBatch,
  parseTemplate,
  type FunctionOptions,
  type TemplateFunction,
  type BatchableFunction,
  type StreamableList,
  type ChainablePromise,
} from './template.js'
import { generateObject, generateText, streamObject } from './generate.js'
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

export interface GenerateOptions extends FunctionOptions {
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
 *
 * @example
 * ```ts
 * // Generate JSON
 * const recipe = await generate('json', 'Italian pasta recipe', {
 *   schema: { name: 'string', ingredients: ['string'] }
 * })
 *
 * // Generate code
 * const code = await generate('code', 'email validator', { language: 'typescript' })
 *
 * // Generate text
 * const text = await generate('text', 'Write a haiku about coding')
 * ```
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

// Helper functions for each type
async function generateTextContent(
  prompt: string,
  model: string,
  options: FunctionOptions
): Promise<string> {
  const result = await generateText({
    model,
    prompt,
    system: options.system,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return result.text
}

async function generateJsonContent(
  prompt: string,
  model: string,
  schema: SimpleSchema | undefined,
  options: FunctionOptions
): Promise<unknown> {
  const effectiveSchema = schema || { result: 'The generated result' }
  const result = await generateObject({
    model,
    schema: effectiveSchema,
    prompt,
    system: options.system,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return result.object
}

async function generateCodeContent(
  prompt: string,
  model: string,
  language: string,
  options: FunctionOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { code: `The ${language} implementation code` },
    prompt: `Generate ${language} code for: ${prompt}`,
    system: `You are an expert ${language} developer. Generate clean, well-documented code.`,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { code: string }).code
}

async function generateListContent(
  prompt: string,
  model: string,
  options: FunctionOptions
): Promise<string[]> {
  const result = await generateObject({
    model,
    schema: { items: ['List items'] },
    prompt,
    system: options.system || 'Generate a list of items based on the prompt.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { items: string[] }).items
}

async function generateListsContent(
  prompt: string,
  model: string,
  options: FunctionOptions
): Promise<Record<string, string[]>> {
  // For lists, we need to generate a dynamic structure
  // The AI will determine the appropriate categories based on the prompt
  const result = await generateObject({
    model,
    schema: {
      categories: ['Category names as strings'],
      data: 'JSON string containing the categorized lists',
    },
    prompt: `Generate categorized lists for: ${prompt}\n\nFirst identify appropriate category names, then provide the lists as a JSON object.`,
    system: options.system || 'Generate multiple categorized lists. Determine appropriate categories based on the prompt.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  const obj = result.object as { categories: string[]; data: string }
  try {
    return JSON.parse(obj.data) as Record<string, string[]>
  } catch {
    // Fallback: create lists from categories
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
  options: FunctionOptions
): Promise<boolean> {
  const result = await generateObject({
    model,
    schema: { answer: 'true | false' },
    prompt,
    system: options.system || 'Answer the question with true or false.',
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens,
  })
  return (result.object as { answer: string }).answer === 'true'
}

async function generateSummaryContent(
  prompt: string,
  model: string,
  options: FunctionOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { summary: 'A concise summary of the content' },
    prompt: `Summarize the following:\n\n${prompt}`,
    system: options.system || 'Create a clear, concise summary.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { summary: string }).summary
}

async function generateExtractContent(
  prompt: string,
  model: string,
  schema: SimpleSchema | undefined,
  options: FunctionOptions
): Promise<unknown[]> {
  const effectiveSchema = schema || { items: ['Extracted items'] }
  const result = await generateObject({
    model,
    schema: effectiveSchema,
    prompt: `Extract from the following:\n\n${prompt}`,
    system: options.system || 'Extract the requested information.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  const obj = result.object as Record<string, unknown>
  // Return items array if present, otherwise return array of values
  if ('items' in obj && Array.isArray(obj.items)) {
    return obj.items
  }
  return Object.values(obj).flat() as unknown[]
}

async function generateYamlContent(
  prompt: string,
  model: string,
  options: FunctionOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { yaml: 'The YAML content' },
    prompt: `Generate YAML for: ${prompt}`,
    system: options.system || 'Generate valid YAML content.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { yaml: string }).yaml
}

async function generateDiagramContent(
  prompt: string,
  model: string,
  format: string,
  options: FunctionOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { diagram: `The ${format} diagram code` },
    prompt: `Generate a ${format} diagram for: ${prompt}`,
    system: options.system || `Generate ${format} diagram syntax.`,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { diagram: string }).diagram
}

async function generateSlidesContent(
  prompt: string,
  model: string,
  slideCount: number,
  options: FunctionOptions
): Promise<string> {
  const result = await generateObject({
    model,
    schema: { slides: `Slidev/Marp markdown with ${slideCount} slides` },
    prompt: `Generate a ${slideCount}-slide presentation about: ${prompt}`,
    system: options.system || 'Generate markdown slides in Slidev/Marp format.',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return (result.object as { slides: string }).slides
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate text content
 *
 * @example
 * ```ts
 * const post = await write`blog post about ${topic}`
 * const post = await write`blog post`({ model: 'claude-opus-4-5' })
 * ```
 */
export const write: BatchableFunction<string> = withBatch(
  createTemplateFunction(async (prompt: string, options?: FunctionOptions) => {
    return generate('text', prompt, options) as Promise<string>
  }),
  async (inputs: string[]) => {
    return Promise.all(inputs.map((input) => generate('text', input) as Promise<string>))
  }
)

/**
 * Generate code
 *
 * @example
 * ```ts
 * const code = await code`email validation function`
 * const code = await code`validator`({ language: 'python' })
 * ```
 */
export const code: TemplateFunction<string> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('code', prompt, options) as Promise<string>
  }
)

/**
 * Generate a list of items (supports async iteration)
 *
 * @example
 * ```ts
 * // Await for full array
 * const ideas = await list`startup ideas`
 *
 * // Stream items
 * for await (const idea of list`startup ideas`) {
 *   console.log(idea)
 * }
 * ```
 */
export function list(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): StreamableList<string> & { (options?: FunctionOptions): Promise<string[]> } {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  const getItems = async (options?: FunctionOptions) => {
    return generate('list', prompt, options) as Promise<string[]>
  }

  const streamable = createStreamableList(
    () => getItems(),
    async function* () {
      const items = await getItems()
      for (const item of items) {
        yield item
      }
    }
  )

  // Add options function
  const result = Object.assign(
    (options?: FunctionOptions) => getItems(options),
    streamable
  )

  return result as StreamableList<string> & { (options?: FunctionOptions): Promise<string[]> }
}

/**
 * Generate multiple named lists
 *
 * @example
 * ```ts
 * const { pros, cons } = await lists`pros and cons of ${topic}`
 * ```
 */
export const lists: TemplateFunction<Record<string, string[]>> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('lists', prompt, options) as Promise<Record<string, string[]>>
  }
)

/**
 * Extract items from text (supports async iteration)
 *
 * @example
 * ```ts
 * const emails = await extract`email addresses from ${document}`
 *
 * for await (const email of extract`emails from ${doc}`) {
 *   await notify(email)
 * }
 * ```
 */
export function extract(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): StreamableList<unknown> & { (options?: FunctionOptions): Promise<unknown[]> } {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  const getItems = async (options?: FunctionOptions) => {
    return generate('extract', prompt, options) as Promise<unknown[]>
  }

  const streamable = createStreamableList(
    () => getItems(),
    async function* () {
      const items = await getItems()
      for (const item of items) {
        yield item
      }
    }
  )

  const result = Object.assign(
    (options?: FunctionOptions) => getItems(options),
    streamable
  )

  return result as StreamableList<unknown> & { (options?: FunctionOptions): Promise<unknown[]> }
}

/**
 * Summarize text
 *
 * @example
 * ```ts
 * const summary = await summarize`${longArticle}`
 * ```
 */
export const summarize: TemplateFunction<string> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('summary', prompt, options) as Promise<string>
  }
)

/**
 * Check if something is true/false
 *
 * @example
 * ```ts
 * const isColor = await is`${topic} a color`
 * if (await is`${email} valid email format`) { ... }
 * ```
 */
function isImpl(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): ChainablePromise<boolean> {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  return createChainablePromise(async (options?: FunctionOptions) => {
    return generate('boolean', prompt, options) as Promise<boolean>
  })
}

export { isImpl as is }

/**
 * Generate a diagram
 *
 * @example
 * ```ts
 * const diagram = await diagram`user authentication flow`
 * const svg = await diagram`auth flow`({ format: 'svg' })
 * ```
 */
export const diagram: TemplateFunction<string> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('diagram', prompt, options) as Promise<string>
  }
)

/**
 * Generate presentation slides
 *
 * @example
 * ```ts
 * const slides = await slides`quarterly review`({ slides: 10 })
 * ```
 */
export const slides: TemplateFunction<string> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('slides', prompt, options) as Promise<string>
  }
)

/**
 * Generate an image
 *
 * @example
 * ```ts
 * const image = await image`sunset over mountains`
 * ```
 */
export const image: TemplateFunction<Buffer> = createTemplateFunction(
  async (_prompt: string, _options?: FunctionOptions) => {
    // Placeholder - actual implementation would use DALL-E, Stable Diffusion, etc.
    return Buffer.from('placeholder-image')
  }
)

/**
 * Generate a video
 *
 * @example
 * ```ts
 * const video = await video`product demo`
 * ```
 */
export const video: TemplateFunction<Buffer> = createTemplateFunction(
  async (_prompt: string, _options?: FunctionOptions) => {
    // Placeholder - actual implementation would use video generation API
    return Buffer.from('placeholder-video')
  }
)

// ============================================================================
// Agentic Functions
// ============================================================================

/**
 * Execute a task with tools (single-pass, not an agentic loop)
 *
 * @example
 * ```ts
 * const result = await do`send welcome email to ${user}`
 * ```
 */
function doImpl(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): ChainablePromise<{ summary: string; actions: string[] }> {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  return createChainablePromise(async (options?: FunctionOptions) => {
    const result = await generateObject({
      model: options?.model || 'sonnet',
      schema: {
        summary: 'Summary of what was done',
        actions: ['List of actions taken'],
      },
      prompt: `Execute this task: ${prompt}`,
      system: 'You are a task executor. Describe what actions you would take.',
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    })
    return result.object as { summary: string; actions: string[] }
  })
}

export { doImpl as do }

/**
 * Conduct research on a topic
 *
 * @example
 * ```ts
 * const research = await research`${competitor} vs our product`
 * ```
 */
export const research: TemplateFunction<{ summary: string; findings: string[]; sources: string[] }> =
  createTemplateFunction(async (prompt: string, options?: FunctionOptions) => {
    const result = await generateObject({
      model: options?.model || 'sonnet',
      schema: {
        summary: 'Overall research summary',
        findings: ['Key findings'],
        sources: ['Source references'],
      },
      prompt: `Research the following: ${prompt}`,
      system: options?.system || 'You are a research analyst. Provide thorough research.',
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    })
    return result.object as { summary: string; findings: string[]; sources: string[] }
  })

// ============================================================================
// Web Functions
// ============================================================================

/**
 * Read a URL and convert to markdown
 *
 * @example
 * ```ts
 * const content = await read`https://example.com/article`
 * ```
 */
export const read: TemplateFunction<string> = createTemplateFunction(
  async (_url: string, _options?: FunctionOptions) => {
    // Placeholder - actual implementation would use Firecrawl or similar
    return '# Content\n\nPage content would be here.'
  }
)

/**
 * Browse a URL with browser automation
 *
 * @example
 * ```ts
 * const page = await browse`https://app.example.com`
 * await page.do('click login button')
 * const data = await page.extract('user info')
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
  let _url: string
  if (Array.isArray(urlOrStrings) && 'raw' in urlOrStrings) {
    _url = parseTemplate(urlOrStrings as TemplateStringsArray, ...args)
  } else {
    _url = urlOrStrings as string
  }

  // Placeholder - actual implementation would use Stagehand or Playwright
  return {
    do: async (_action: string) => {
      // Execute browser action
    },
    extract: async (_query: string) => {
      // Extract data from page
      return {}
    },
    screenshot: async () => {
      return Buffer.from('screenshot')
    },
    close: async () => {
      // Close browser session
    },
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
): <T>(...options: T[]) => Promise<T> {
  let criteria: string
  if (Array.isArray(criteriaOrStrings) && 'raw' in criteriaOrStrings) {
    criteria = parseTemplate(criteriaOrStrings as TemplateStringsArray, ...templateArgs)
  } else {
    criteria = criteriaOrStrings as string
  }

  return async <T>(...options: T[]): Promise<T> => {
    const optionDescriptions = options
      .map((opt, i) => `Option ${i + 1}: ${JSON.stringify(opt)}`)
      .join('\n')

    const result = await generateObject({
      model: 'sonnet',
      schema: {
        chosenIndex: 'The index (1-based) of the best option as a number',
        reasoning: 'Brief explanation of why this option is best',
      },
      prompt: `Given these options:\n${optionDescriptions}\n\nChoose the best option based on: ${criteria}`,
      system: 'You are a judge. Analyze the options and choose the best one based on the given criteria. Return chosenIndex as a number.',
    })

    const obj = result.object as { chosenIndex: string | number; reasoning: string }
    const chosenIndex = typeof obj.chosenIndex === 'string' ? parseInt(obj.chosenIndex, 10) : obj.chosenIndex
    return options[chosenIndex - 1]!
  }
}

// ============================================================================
// Human-in-the-Loop Functions
// ============================================================================

/**
 * Human interaction options
 */
export interface HumanOptions extends FunctionOptions {
  /** Channel for human interaction */
  channel?: HumanChannel
  /** Who should handle this request */
  assignee?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Webhook URL for async notification */
  webhook?: string
}

/**
 * Human interaction result
 */
export interface HumanResult<T = unknown> {
  /** Whether the request is pending human response */
  pending: boolean
  /** Request ID for tracking */
  requestId: string
  /** The human's response (when available) */
  response?: T
  /** Who responded */
  respondedBy?: string
  /** When they responded */
  respondedAt?: Date
  /** Generated artifacts for the channel */
  artifacts?: {
    slackBlocks?: unknown[]
    emailHtml?: string
    webComponent?: string
    smsText?: string
  }
}

/**
 * Ask a human for input
 *
 * Generates appropriate UI/message for the specified channel and waits for response.
 *
 * @example
 * ```ts
 * const decision = await ask`should we proceed with ${plan}?`
 * const name = await ask`what should we name this project?`({ channel: 'workspace' })
 * ```
 */
export function ask(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): ChainablePromise<HumanResult<string>> {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  return createChainablePromise(async (options?: FunctionOptions) => {
    const humanOpts = options as HumanOptions | undefined
    const channel = humanOpts?.channel || 'web'
    const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Generate channel-appropriate content
    const artifacts = await generateChannelContent(prompt, channel, 'ask')

    // In a real implementation, this would:
    // 1. Send the request to the appropriate channel
    // 2. Wait for webhook callback or poll for response
    // 3. Return the actual response

    return {
      pending: true,
      requestId,
      artifacts,
    } as HumanResult<string>
  })
}

/**
 * Request human approval
 *
 * Generates an approval request with approve/reject options.
 *
 * @example
 * ```ts
 * const approved = await approve`${expense} expense for $${amount}`
 * if (approved.response?.approved) {
 *   // proceed
 * }
 * ```
 */
export function approve(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): ChainablePromise<HumanResult<{ approved: boolean; notes?: string }>> {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  return createChainablePromise(async (options?: FunctionOptions) => {
    const humanOpts = options as HumanOptions | undefined
    const channel = humanOpts?.channel || 'web'
    const requestId = `approve_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Generate approval UI
    const artifacts = await generateChannelContent(prompt, channel, 'approve')

    return {
      pending: true,
      requestId,
      artifacts,
    } as HumanResult<{ approved: boolean; notes?: string }>
  })
}

/**
 * Request human review
 *
 * Generates a review request with feedback options.
 *
 * @example
 * ```ts
 * const review = await review`please review this ${document}`
 * console.log(review.response?.feedback)
 * ```
 */
export function review(
  promptOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): ChainablePromise<HumanResult<{ rating?: number; feedback: string; approved?: boolean }>> {
  let prompt: string
  if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
    prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
  } else {
    prompt = promptOrStrings as string
  }

  return createChainablePromise(async (options?: FunctionOptions) => {
    const humanOpts = options as HumanOptions | undefined
    const channel = humanOpts?.channel || 'web'
    const requestId = `review_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Generate review UI
    const artifacts = await generateChannelContent(prompt, channel, 'review')

    return {
      pending: true,
      requestId,
      artifacts,
    } as HumanResult<{ rating?: number; feedback: string; approved?: boolean }>
  })
}

/**
 * Generate channel-appropriate content for human interaction
 */
async function generateChannelContent(
  prompt: string,
  channel: string,
  interactionType: 'ask' | 'approve' | 'review'
): Promise<HumanResult['artifacts']> {
  const schemas: Record<string, Record<string, string>> = {
    slack: {
      blocks: 'Slack BlockKit JSON array as a string',
      text: 'Plain text fallback message',
    },
    email: {
      subject: 'Email subject line',
      html: 'Email HTML body',
      text: 'Plain text version',
    },
    web: {
      title: 'Form title',
      description: 'Form description',
      fields: 'JSON array of form fields',
    },
    sms: {
      text: 'SMS message (max 160 chars)',
    },
  }

  const schema = schemas[channel] || schemas.web

  const result = await generateObject({
    model: 'sonnet',
    schema,
    prompt: `Generate ${channel} content for a "${interactionType}" interaction:\n\n${prompt}`,
    system: `Generate appropriate ${channel} UI/content for human-in-the-loop interaction. Type: ${interactionType}`,
  })

  const obj = result.object as Record<string, string>

  switch (channel) {
    case 'workspace':
      return { slackBlocks: JSON.parse(obj.blocks || '[]') }
    case 'email':
      return { emailHtml: obj.html }
    case 'sms':
      return { smsText: obj.text }
    default:
      return { webComponent: JSON.stringify(obj) }
  }
}

// ============================================================================
// Main ai() function
// ============================================================================

/**
 * General-purpose AI function
 *
 * @example
 * ```ts
 * const text = await ai`write a poem about ${topic}`
 * const data = await ai`analyze ${data}`({ model: 'claude-opus-4-5' })
 * ```
 */
export const ai: TemplateFunction<string> = createTemplateFunction(
  async (prompt: string, options?: FunctionOptions) => {
    return generate('text', prompt, options) as Promise<string>
  }
)
