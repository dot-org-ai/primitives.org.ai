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
import type {
  AgenticFunctionDefinition,
  AutoDefineResult,
  CodeFunctionDefinition,
  DefinedFunction,
  FunctionDefinition,
  FunctionRegistry,
  GenerativeFunctionDefinition,
  HumanChannel,
  HumanFunctionDefinition,
} from './types.js'
import { createDefinedFunction, defineFunction, functions } from './function-registry.js'

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
    ;(promise as { resolve: () => Promise<T> }).resolve = async () => {
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

// ============================================================================
// Auto-Define Functions
//
// Inlined from former ai-proxy.ts. These helpers provide the auto-define
// convenience layer (analyze a name + example args, infer a function type and
// schema, register it). Property-access tracking lives entirely in
// ai-promise.ts; this section is a shallow dispatch over define() and
// generateObject().
// ============================================================================

/**
 * Analyze a function call and determine what type of function it should be
 */
async function analyzeFunction(
  name: string,
  args: Record<string, unknown>
): Promise<AutoDefineResult> {
  // Convert camelCase/snake_case to readable name
  const readableName = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim()

  const argDescriptions = Object.entries(args)
    .map(([key, value]) => {
      const type = Array.isArray(value) ? 'array' : typeof value
      return `  - ${key}: ${type} (example: ${JSON.stringify(value).slice(0, 50)})`
    })
    .join('\n')

  const result = await generateObject({
    model: 'sonnet',
    schema: {
      type: 'code | generative | agentic | human',
      reasoning: 'Why this function type is appropriate (1-2 sentences)',
      description: 'What this function does',
      output: 'string | object | image | video | audio',
      returnType: 'Schema for the return type as a SimpleSchema object',
      system: 'System prompt for the AI (if generative/agentic)',
      promptTemplate: 'Prompt template with {{arg}} placeholders',
      instructions: 'Instructions for agentic/human functions',
      needsTools: 'true | false',
      suggestedTools: ['Names of tools that might be needed'],
      channel: 'slack | email | web | sms | custom',
    },
    system: `You are an expert at designing AI functions. Analyze the function name and arguments to determine the best function type.

Function Types:
- "code": For generating executable code (calculations, algorithms, data transformations)
- "generative": For generating content (text, summaries, translations, creative writing, structured data)
- "agentic": For complex tasks requiring multiple steps, research, or tool use (research, planning, multi-step workflows)
- "human": For tasks requiring human judgment, approval, or input (approvals, reviews, decisions)

Guidelines:
- Most functions should be "generative" - they generate content or structured data
- Use "code" only when actual executable code needs to be generated
- Use "agentic" when the task requires research, multiple steps, or external tool use
- Use "human" when human judgment/approval is essential`,
    prompt: `Analyze this function call and determine how to define it:

Function Name: ${name}
Readable Name: ${readableName}
Arguments:
${argDescriptions || '  (no arguments)'}

Determine:
1. What type of function this should be
2. What it should return
3. How it should be implemented`,
  })

  const analysis = result.object as {
    type: string
    reasoning: string
    description: string
    output: string
    returnType: unknown
    system: string
    promptTemplate: string
    instructions: string
    needsTools: string
    suggestedTools: string[]
    channel: string
  }

  // Build the function definition based on the analysis
  let definition: FunctionDefinition

  const baseDefinition = {
    name,
    description: analysis.description,
    args: inferArgsSchema(args),
    returnType: analysis.returnType as SimpleSchema,
  }

  switch (analysis.type) {
    case 'code':
      definition = {
        ...baseDefinition,
        type: 'code' as const,
        language: 'typescript' as const,
        instructions: analysis.instructions,
      }
      break

    case 'agentic':
      definition = {
        ...baseDefinition,
        type: 'agentic' as const,
        instructions: analysis.instructions || `Complete the ${readableName} task`,
        promptTemplate: analysis.promptTemplate,
        tools: [], // Tools would need to be provided separately
        maxIterations: 10,
      }
      break

    case 'human':
      definition = {
        ...baseDefinition,
        type: 'human' as const,
        channel: (analysis.channel || 'web') as HumanChannel,
        instructions:
          analysis.instructions || `Please review and respond to this ${readableName} request`,
        promptTemplate: analysis.promptTemplate,
      }
      break

    case 'generative':
    default:
      definition = {
        ...baseDefinition,
        type: 'generative' as const,
        output: (analysis.output || 'object') as 'string' | 'object' | 'image' | 'video',
        system: analysis.system,
        promptTemplate: analysis.promptTemplate || `{{${Object.keys(args)[0] || 'input'}}}`,
      }
      break
  }

  return {
    type: analysis.type as 'code' | 'generative' | 'agentic' | 'human',
    reasoning: analysis.reasoning,
    definition,
  }
}

/**
 * Infer a schema from example arguments
 */
function inferArgsSchema(
  args: Record<string, unknown>
): Record<string, string | string[] | Record<string, unknown>> {
  const schema: Record<string, string | string[] | Record<string, unknown>> = {}

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      schema[key] = `The ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`
    } else if (typeof value === 'number') {
      schema[key] = `The ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} (number)`
    } else if (typeof value === 'boolean') {
      schema[key] = `Whether ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} (boolean)`
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'string') {
        schema[key] = [`List of ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`]
      } else {
        schema[key] = [`Items for ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`]
      }
    } else if (typeof value === 'object' && value !== null) {
      schema[key] = inferArgsSchema(value as Record<string, unknown>)
    } else {
      schema[key] = `The ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`
    }
  }

  return schema
}

/**
 * Auto-define a function based on its name and arguments, or define with explicit definition
 *
 * When called with (name, args), uses AI to analyze and determine:
 * - What type of function it should be (code, generative, agentic, human)
 * - What it should return
 * - How it should be implemented
 *
 * When called with a FunctionDefinition, creates the function directly.
 *
 * @example
 * ```ts
 * // Auto-define from name and example args
 * const planTrip = await define('planTrip', { destination: 'Tokyo', travelers: 2 })
 *
 * // Or define explicitly
 * const summarize = define.generative({
 *   name: 'summarize',
 *   args: { text: 'Text to summarize' },
 *   output: 'string',
 * })
 *
 * // Or with full definition
 * const fn = defineFunction({
 *   type: 'generative',
 *   name: 'translate',
 *   args: { text: 'Text', lang: 'Target language' },
 *   output: 'string',
 * })
 * ```
 */
async function autoDefineImpl(
  name: string,
  args: Record<string, unknown>
): Promise<DefinedFunction> {
  // Check if already defined
  const existing = functions.get(name)
  if (existing) {
    return existing
  }

  // Analyze and define the function
  const { definition } = await analyzeFunction(name, args)

  // Create the defined function
  const definedFn = createDefinedFunction(definition)

  // Store in registry
  functions.set(name, definedFn)

  return definedFn
}

/**
 * Define functions - auto-define or use typed helpers
 */
export const define = Object.assign(autoDefineImpl, {
  /**
   * Define a code generation function
   */
  code: <TOutput, TInput>(
    definition: Omit<CodeFunctionDefinition<TOutput, TInput>, 'type'>
  ): DefinedFunction<TOutput, TInput> => {
    const fn = defineFunction({ type: 'code', ...definition } as CodeFunctionDefinition<
      TOutput,
      TInput
    >)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define a generative function
   */
  generative: <TOutput, TInput>(
    definition: Omit<GenerativeFunctionDefinition<TOutput, TInput>, 'type'>
  ): DefinedFunction<TOutput, TInput> => {
    const fn = defineFunction({ type: 'generative', ...definition } as GenerativeFunctionDefinition<
      TOutput,
      TInput
    >)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define an agentic function
   */
  agentic: <TOutput, TInput>(
    definition: Omit<AgenticFunctionDefinition<TOutput, TInput>, 'type'>
  ): DefinedFunction<TOutput, TInput> => {
    const fn = defineFunction({ type: 'agentic', ...definition } as AgenticFunctionDefinition<
      TOutput,
      TInput
    >)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define a human-in-the-loop function
   */
  human: <TOutput, TInput>(
    definition: Omit<HumanFunctionDefinition<TOutput, TInput>, 'type'>
  ): DefinedFunction<TOutput, TInput> => {
    const fn = defineFunction({ type: 'human', ...definition } as HumanFunctionDefinition<
      TOutput,
      TInput
    >)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },
})

// ============================================================================
// AI Proxy - Smart AI Client with Auto-Definition
// ============================================================================

/** Known built-in method names that should not be auto-defined */
const BUILTIN_METHODS = new Set([
  'do',
  'is',
  'code',
  'decide',
  'diagram',
  'generate',
  'image',
  'video',
  'write',
  'list',
  'lists',
  'functions',
  'define',
  'defineFunction',
  'then',
  'catch',
  'finally',
])

/**
 * Type for the AI proxy with auto-define capability
 */
export interface AIProxy {
  /** Function registry */
  functions: FunctionRegistry
  /** Define functions */
  define: typeof define
  /** Define a function with full definition */
  defineFunction: typeof defineFunction
  /** Dynamic function calls */
  [key: string]: unknown
}

/**
 * Create a smart AI client that auto-defines functions on first call
 *
 * @example
 * ```ts
 * const ai = createSmartAI()
 *
 * // First call - auto-defines the function
 * const trip = await ai.planTrip({
 *   destination: 'Tokyo',
 *   dates: { start: '2024-03-01', end: '2024-03-10' },
 *   travelers: 2,
 * })
 *
 * // Second call - uses cached definition (in-memory)
 * const trip2 = await ai.planTrip({
 *   destination: 'Paris',
 *   dates: { start: '2024-06-01', end: '2024-06-07' },
 *   travelers: 4,
 * })
 *
 * // Access registry and define
 * console.log(ai.functions.list()) // ['planTrip']
 * ai.define.generative({ name: 'summarize', ... })
 * ```
 */
export function createSmartAI(): AIProxy {
  const base = {
    functions,
    define,
    defineFunction,
  }

  return new Proxy(base as AIProxy, {
    get(target, prop: string) {
      // Return built-in properties
      if (prop in target) {
        return (target as Record<string, unknown>)[prop]
      }

      // Skip internal properties
      if (typeof prop === 'symbol' || prop.startsWith('_') || BUILTIN_METHODS.has(prop)) {
        return undefined
      }

      // Return a function that auto-defines and calls
      return async (args: Record<string, unknown> = {}) => {
        // Check if function is already defined
        let fn = functions.get(prop)

        if (!fn) {
          // Auto-define the function
          fn = await define(prop, args)
        }

        // Call the function
        return fn.call(args)
      }
    },
  })
}

/**
 * Default AI proxy instance with auto-define capability.
 *
 * This is the smart proxy `aiProxy` (re-exported from index.ts as `aiProxy`).
 * It is intentionally distinct from the `ai` template-tag primitive above —
 * see `ai` (line ~354) for the template function used like `ai\`...\``.
 *
 * @example
 * ```ts
 * import { aiProxy } from 'ai-functions'
 *
 * // Auto-define and call
 * const result = await aiProxy.summarize({ text: 'Long article...' })
 *
 * // Access functions registry
 * aiProxy.functions.list()
 *
 * // Define explicitly
 * aiProxy.define.generative({ name: 'translate', ... })
 * ```
 */
export const aiProxy: AIProxy = createSmartAI()
