/**
 * AI() and ai() - Core AI function constructors
 *
 * These provide the main entry points for AI-powered functions,
 * with full RPC promise pipelining support via capnweb.
 */

import { RpcTarget } from 'capnweb'

// Use Promise as RpcPromise for type definitions
// The actual RPC layer handles pipelining transparently
type RpcPromise<T> = Promise<T>
import { createRPCSession, type RPCSessionOptions } from './rpc/session.js'
import { generateObject } from './generate.js'
import type { SimpleSchema } from './schema.js'
import type { LanguageModel } from 'ai'
import type {
  AIClient,
  AIFunctionDefinition,
  AIGenerateOptions,
  AIGenerateResult,
  JSONSchema,
  ImageOptions,
  ImageResult,
  VideoOptions,
  VideoResult,
  WriteOptions,
  ListResult,
  ListsResult,
  FunctionDefinition,
  DefinedFunction,
  CodeFunctionDefinition,
  CodeFunctionResult,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
  HumanChannel,
  CodeLanguage,
  FunctionRegistry,
  AutoDefineResult
} from './types.js'
import { schema as convertSchema, type SimpleSchema as SimpleSchemaType } from './schema.js'

/**
 * Options for creating an AI RPC client instance
 */
export interface AIClientOptions extends RPCSessionOptions {
  /** Default model to use */
  model?: string
  /** Default temperature */
  temperature?: number
  /** Default max tokens */
  maxTokens?: number
  /** Custom functions available to the AI */
  functions?: AIFunctionDefinition[]
}

/**
 * Options for AI schema functions (subset of generateObject options)
 */
export interface AISchemaOptions {
  /** Model to use (string alias or LanguageModel) */
  model?: string | LanguageModel
  /** System prompt */
  system?: string
  /** Generation mode */
  mode?: 'auto' | 'json' | 'tool'
  /** Temperature (0-2) */
  temperature?: number
  /** Top P sampling */
  topP?: number
  /** Top K sampling */
  topK?: number
  /** Presence penalty */
  presencePenalty?: number
  /** Frequency penalty */
  frequencyPenalty?: number
  /** Max tokens to generate */
  maxTokens?: number
  /** Max retries on failure */
  maxRetries?: number
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Custom headers */
  headers?: Record<string, string>
}

/**
 * Schema-based functions
 */
type SchemaFunctions<T extends Record<string, SimpleSchema>> = {
  [K in keyof T]: (prompt?: string, options?: AISchemaOptions) => Promise<InferSimpleSchemaResult<T[K]>>
}

/**
 * Create AI functions from schemas
 *
 * @example
 * ```ts
 * const ai = AI({
 *   storyBrand: {
 *     hero: 'Who is the customer?',
 *     problem: {
 *       internal: 'What internal problem do they face?',
 *       external: 'What external challenge exists?',
 *       philosophical: 'Why is this wrong?',
 *     },
 *     guide: 'Who helps them? (the brand)',
 *     plan: ['What are the steps to success?'],
 *     callToAction: 'What should they do?',
 *     success: 'What does success look like?',
 *     failure: 'What happens if they fail?',
 *   },
 *   recipe: {
 *     name: 'Recipe name',
 *     type: 'food | drink | dessert',
 *     servings: 'How many servings? (number)',
 *     ingredients: ['List all ingredients'],
 *     steps: ['Cooking steps in order'],
 *   },
 * })
 *
 * // Call the generated functions
 * const brand = await ai.storyBrand('Acme Corp sells widgets')
 * const dinner = await ai.recipe('Italian pasta for 4 people')
 * ```
 */
export function AI<T extends Record<string, SimpleSchema>>(
  schemas: T,
  defaultOptions?: AISchemaOptions
): SchemaFunctions<T>

/**
 * Create an AI RPC client instance
 *
 * @example
 * ```ts
 * // Connect to remote AI service
 * const ai = AI({ wsUrl: 'wss://ai.example.com/rpc' })
 *
 * // Use promise pipelining - single round trip!
 * const result = ai.generate({ prompt: 'Hello' })
 * const upper = result.text.map(t => t.toUpperCase())
 * console.log(await upper)
 *
 * // Dynamic function calling
 * const summary = await ai.summarize({ text: longText })
 * ```
 */
export function AI(options: AIClientOptions): AIClient & Record<string, (...args: unknown[]) => RpcPromise<unknown>>

export function AI<T extends Record<string, SimpleSchema>>(
  schemasOrOptions: T | AIClientOptions,
  defaultOptions?: AISchemaOptions
): SchemaFunctions<T> | (AIClient & Record<string, (...args: unknown[]) => RpcPromise<unknown>>) {
  // Check if this is RPC client mode
  if (isAIClientOptions(schemasOrOptions)) {
    const { model, temperature, maxTokens, functions, ...sessionOptions } = schemasOrOptions

    // Create RPC session to AI service
    const client = createRPCSession<AIClient>(sessionOptions)

    // Create a proxy that handles both defined methods and dynamic function calls
    return new Proxy(client, {
      get(target, prop: string) {
        // Return existing methods
        if (prop in target) {
          return (target as unknown as Record<string, unknown>)[prop]
        }

        // Handle dynamic function calls (ai.functionName())
        return (...args: unknown[]) => {
          return target.do(prop, args.length === 1 ? args[0] : args)
        }
      }
    }) as AIClient & Record<string, (...args: unknown[]) => RpcPromise<unknown>>
  }

  // Schema functions mode - create a function for each schema
  return createSchemaFunctions(schemasOrOptions as Record<string, SimpleSchema>, defaultOptions) as SchemaFunctions<T>
}

/**
 * Check if options are AI client options vs schemas
 */
function isAIClientOptions(value: unknown): value is AIClientOptions {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return 'wsUrl' in obj || 'httpUrl' in obj || 'functions' in obj
}

/**
 * Infer result type from simple schema
 */
type InferSimpleSchemaResult<T> = T extends string
  ? string
  : T extends [string]
  ? string[]
  : T extends { [K: string]: SimpleSchema }
  ? { [K in keyof T]: InferSimpleSchemaResult<T[K]> }
  : unknown

/**
 * Create schema-based functions from a map of schemas
 */
function createSchemaFunctions<T extends Record<string, SimpleSchema>>(
  schemas: T,
  defaultOptions: AISchemaOptions = {}
): SchemaFunctions<T> {
  const functions: Record<string, (prompt?: string, options?: AISchemaOptions) => Promise<unknown>> = {}

  for (const [name, schema] of Object.entries(schemas)) {
    functions[name] = async (prompt?: string, options?: AISchemaOptions) => {
      const mergedOptions = { ...defaultOptions, ...options }
      const { model = 'sonnet', system, ...rest } = mergedOptions

      // Build prompt from schema descriptions if none provided
      const schemaPrompt = prompt || buildPromptFromSchema(schema)

      const result = await generateObject({
        model,
        schema,
        prompt: schemaPrompt,
        system,
        ...rest,
      })

      return result.object
    }
  }

  return functions as SchemaFunctions<T>
}

/**
 * Build a prompt by extracting descriptions from the schema
 */
function buildPromptFromSchema(schema: SimpleSchema, path = ''): string {
  if (typeof schema === 'string') {
    return schema
  }

  if (Array.isArray(schema)) {
    return schema[0] as string || 'Generate items'
  }

  if (typeof schema === 'object' && schema !== null) {
    const descriptions: string[] = []
    for (const [key, value] of Object.entries(schema)) {
      const subPrompt = buildPromptFromSchema(value as SimpleSchema, path ? `${path}.${key}` : key)
      if (subPrompt) {
        descriptions.push(`${key}: ${subPrompt}`)
      }
    }
    return descriptions.length > 0 ? `Generate the following:\n${descriptions.join('\n')}` : ''
  }

  return ''
}

/**
 * Create a defined function from a function definition
 */
function createDefinedFunction<TArgs, TReturn>(
  definition: FunctionDefinition<TArgs, TReturn>
): DefinedFunction<TArgs, TReturn> {
  const call = async (args: TArgs): Promise<TReturn> => {
    switch (definition.type) {
      case 'code':
        return executeCodeFunction(definition, args) as Promise<TReturn>
      case 'generative':
        return executeGenerativeFunction(definition, args) as Promise<TReturn>
      case 'agentic':
        return executeAgenticFunction(definition, args) as Promise<TReturn>
      case 'human':
        return executeHumanFunction(definition, args) as Promise<TReturn>
      default:
        throw new Error(`Unknown function type: ${(definition as FunctionDefinition).type}`)
    }
  }

  const asTool = (): AIFunctionDefinition<TArgs, TReturn> => {
    return {
      name: definition.name,
      description: definition.description || `Execute ${definition.name}`,
      parameters: convertArgsToJSONSchema(definition.args),
      handler: call,
    }
  }

  return { definition, call, asTool }
}

/**
 * Convert args schema to JSON Schema
 */
function convertArgsToJSONSchema(args: unknown): JSONSchema {
  // If it's already a JSON schema-like object
  if (typeof args === 'object' && args !== null && 'type' in args) {
    return args as JSONSchema
  }

  // Convert SimpleSchema to JSON Schema
  const properties: Record<string, JSONSchema> = {}
  const required: string[] = []

  if (typeof args === 'object' && args !== null) {
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      required.push(key) // All properties required for cross-provider compatibility
      properties[key] = convertValueToJSONSchema(value)
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false, // Required for OpenAI compatibility
  }
}

/**
 * Convert a single value to JSON Schema
 */
function convertValueToJSONSchema(value: unknown): JSONSchema {
  if (typeof value === 'string') {
    // Check for type hints: 'description (number)', 'description (boolean)', etc.
    const typeMatch = value.match(/^(.+?)\s*\((number|boolean|integer|date)\)$/i)
    if (typeMatch) {
      const description = typeMatch[1]!
      const type = typeMatch[2]!
      switch (type.toLowerCase()) {
        case 'number':
          return { type: 'number', description: description.trim() }
        case 'integer':
          return { type: 'integer', description: description.trim() }
        case 'boolean':
          return { type: 'boolean', description: description.trim() }
        case 'date':
          return { type: 'string', format: 'date-time', description: description.trim() }
      }
    }

    // Check for enum: 'option1 | option2 | option3'
    if (value.includes(' | ')) {
      const options = value.split(' | ').map(s => s.trim())
      return { type: 'string', enum: options }
    }

    return { type: 'string', description: value }
  }

  if (Array.isArray(value) && value.length === 1) {
    const [desc] = value
    if (typeof desc === 'string') {
      return { type: 'array', items: { type: 'string' }, description: desc }
    }
    if (typeof desc === 'number') {
      return { type: 'array', items: { type: 'number' } }
    }
    return { type: 'array', items: convertValueToJSONSchema(desc) }
  }

  if (typeof value === 'object' && value !== null) {
    return convertArgsToJSONSchema(value)
  }

  return { type: 'string' }
}

/**
 * Fill template with values
 */
function fillTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(args[key] ?? ''))
}

/**
 * Execute a code function - generates code with tests and examples
 */
async function executeCodeFunction<TArgs>(
  definition: CodeFunctionDefinition<TArgs>,
  args: TArgs
): Promise<CodeFunctionResult> {
  const { name, description, language = 'typescript', instructions, includeTests = true, includeExamples = true } = definition

  const argsDescription = JSON.stringify(args, null, 2)

  const result = await generateObject({
    model: 'sonnet',
    schema: {
      code: 'The complete implementation code with JSDoc comments',
      tests: includeTests ? 'Vitest test code for the implementation' : undefined,
      examples: includeExamples ? 'Example usage code' : undefined,
      documentation: 'JSDoc or equivalent documentation string',
    },
    system: `You are an expert ${language} developer. Generate clean, well-documented, production-ready code.`,
    prompt: `Generate a ${language} function with the following specification:

Name: ${name}
Description: ${description || 'No description provided'}
Arguments: ${argsDescription}
Return Type: ${JSON.stringify(definition.returnType)}

${instructions ? `Additional Instructions: ${instructions}` : ''}

Requirements:
- Include comprehensive JSDoc comments
- Follow best practices for ${language}
- Handle edge cases appropriately
${includeTests ? '- Include vitest tests that cover main functionality and edge cases' : ''}
${includeExamples ? '- Include example usage showing how to call the function' : ''}`,
  })

  const obj = result.object as { code: string; tests?: string; examples?: string; documentation: string }
  return {
    code: obj.code,
    tests: obj.tests,
    examples: obj.examples,
    language,
    documentation: obj.documentation,
  }
}

/**
 * Execute a generative function - uses AI to generate content
 */
async function executeGenerativeFunction<TArgs, TReturn>(
  definition: GenerativeFunctionDefinition<TArgs, TReturn>,
  args: TArgs
): Promise<TReturn> {
  const { output, system, promptTemplate, model = 'sonnet', temperature, returnType } = definition

  const prompt = promptTemplate
    ? fillTemplate(promptTemplate, args as Record<string, unknown>)
    : JSON.stringify(args)

  switch (output) {
    case 'string': {
      const result = await generateObject({
        model,
        schema: { text: 'The generated text response' },
        system,
        prompt,
        temperature,
      })
      return (result.object as { text: string }).text as TReturn
    }

    case 'object': {
      const objectSchema = returnType || { result: 'The generated result' }
      const result = await generateObject({
        model,
        schema: objectSchema as SimpleSchemaType,
        system,
        prompt,
        temperature,
      })
      return result.object as TReturn
    }

    case 'image': {
      const client = getDefaultAIClient()
      return client.image(prompt) as unknown as Promise<TReturn>
    }

    case 'video': {
      const client = getDefaultAIClient()
      return client.video(prompt) as unknown as Promise<TReturn>
    }

    case 'audio': {
      // Audio generation would need a specific implementation
      throw new Error('Audio generation not yet implemented')
    }

    default:
      throw new Error(`Unknown output type: ${output}`)
  }
}

/**
 * Execute an agentic function - runs in a loop with tools
 */
async function executeAgenticFunction<TArgs, TReturn>(
  definition: AgenticFunctionDefinition<TArgs, TReturn>,
  args: TArgs
): Promise<TReturn> {
  const { instructions, promptTemplate, tools = [], maxIterations = 10, model = 'sonnet', returnType } = definition

  const prompt = promptTemplate
    ? fillTemplate(promptTemplate, args as Record<string, unknown>)
    : JSON.stringify(args)

  // Build system prompt with tool descriptions
  const toolDescriptions = tools.map(t => `- ${t.name}: ${t.description}`).join('\n')
  const systemPrompt = `${instructions}

Available tools:
${toolDescriptions || 'No tools available'}

Work step by step to accomplish the task. When you have completed the task, provide your final result.`

  let iteration = 0
  const toolResults: unknown[] = []

  // Simple agent loop
  while (iteration < maxIterations) {
    iteration++

    const result = await generateObject({
      model,
      schema: {
        thinking: 'Your step-by-step reasoning',
        toolCall: {
          name: 'Tool to call (or "done" if finished)',
          arguments: 'Arguments for the tool as JSON string',
        },
        finalResult: returnType || 'The final result if done',
      },
      system: systemPrompt,
      prompt: `Task: ${prompt}

Previous tool results:
${toolResults.map((r, i) => `Step ${i + 1}: ${JSON.stringify(r)}`).join('\n') || 'None yet'}

What is your next step?`,
    })

    const response = result.object as {
      thinking: string
      toolCall: { name: string; arguments: string }
      finalResult: unknown
    }

    if (response.toolCall.name === 'done' || response.finalResult) {
      return response.finalResult as TReturn
    }

    // Execute tool call
    const tool = tools.find(t => t.name === response.toolCall.name)
    if (tool) {
      const toolArgs = JSON.parse(response.toolCall.arguments || '{}')
      const toolResult = await tool.handler(toolArgs)
      toolResults.push({ tool: response.toolCall.name, result: toolResult })
    } else {
      toolResults.push({ error: `Tool not found: ${response.toolCall.name}` })
    }
  }

  throw new Error(`Agent exceeded maximum iterations (${maxIterations})`)
}

/**
 * Execute a human function - generates UI and waits for human input
 */
async function executeHumanFunction<TArgs, TReturn>(
  definition: HumanFunctionDefinition<TArgs, TReturn>,
  args: TArgs
): Promise<TReturn> {
  const { channel, instructions, promptTemplate, returnType } = definition

  const prompt = promptTemplate
    ? fillTemplate(promptTemplate, args as Record<string, unknown>)
    : JSON.stringify(args)

  // Generate channel-specific UI
  const uiSchema = {
    slack: {
      blocks: ['Slack BlockKit blocks as JSON array'],
      text: 'Plain text fallback',
    },
    email: {
      subject: 'Email subject',
      html: 'Email HTML body',
      text: 'Plain text fallback',
    },
    web: {
      component: 'React component code for the form',
      schema: 'JSON schema for the form fields',
    },
    sms: {
      text: 'SMS message text (max 160 chars)',
    },
    custom: {
      data: 'Structured data for custom implementation',
      instructions: 'Instructions for the human',
    },
  }

  const result = await generateObject({
    model: 'sonnet',
    schema: uiSchema[channel] || uiSchema.custom,
    system: `Generate ${channel} UI/content for a human-in-the-loop task.`,
    prompt: `Task: ${instructions}

Input data:
${prompt}

Expected response format:
${JSON.stringify(returnType)}

Generate the appropriate ${channel} UI/content to collect this response from a human.`,
  })

  // In a real implementation, this would:
  // 1. Send the generated UI to the appropriate channel
  // 2. Wait for human response
  // 3. Return the validated response

  // For now, return the generated artifacts as a placeholder
  return {
    _pending: true,
    channel,
    artifacts: result.object,
    expectedResponseType: returnType,
  } as unknown as TReturn
}

/**
 * Helper to create a function that supports both regular calls and tagged template literals
 * @example
 * const fn = withTemplate((prompt) => doSomething(prompt))
 * fn('hello')      // regular call
 * fn`hello ${name}` // tagged template literal
 */
export function withTemplate<TArgs extends unknown[], TReturn>(
  fn: (prompt: string, ...args: TArgs) => TReturn
): ((prompt: string, ...args: TArgs) => TReturn) & ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn) {
  return function (promptOrStrings: string | TemplateStringsArray, ...args: unknown[]): TReturn {
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      // Tagged template literal call - pass empty args for optional params
      const strings = promptOrStrings as TemplateStringsArray
      const values = args
      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
      return fn(prompt, ...([] as unknown as TArgs))
    }
    // Regular function call
    return fn(promptOrStrings as string, ...(args as TArgs))
  } as ((prompt: string, ...args: TArgs) => TReturn) & ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn)
}

// Default client management
let defaultClient: AIClient | null = null

/**
 * Configure the default AI client
 */
export function configureAI(options: AIClientOptions): void {
  defaultClient = AI(options)
}

/**
 * Get the default AI client, throwing if not configured
 */
function getDefaultAIClient(): AIClient {
  if (!defaultClient) {
    // Try to auto-configure from environment
    const wsUrl = typeof process !== 'undefined' ? process.env?.AI_WS_URL : undefined
    const httpUrl = typeof process !== 'undefined' ? process.env?.AI_HTTP_URL : undefined

    if (wsUrl || httpUrl) {
      defaultClient = AI({ wsUrl, httpUrl })
    } else {
      throw new Error(
        'AI client not configured. Call configureAI() first or set AI_WS_URL/AI_HTTP_URL environment variables.'
      )
    }
  }
  return defaultClient
}

/**
 * Base class for implementing AI services
 *
 * Extend this class to create your own AI service implementation.
 *
 * @example
 * ```ts
 * class MyAIService extends AIServiceTarget {
 *   async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
 *     // Your implementation
 *   }
 * }
 * ```
 */
export abstract class AIServiceTarget extends RpcTarget implements AIClient {
  abstract generate(options: AIGenerateOptions): RpcPromise<AIGenerateResult>
  abstract do(action: string, context?: unknown): RpcPromise<unknown>
  abstract is(value: unknown, type: string | JSONSchema): RpcPromise<boolean>
  abstract code(prompt: string, language?: string): RpcPromise<string>
  abstract decide<T extends string>(options: T[], context?: string): RpcPromise<T>
  abstract diagram(description: string, format?: 'mermaid' | 'svg' | 'ascii'): RpcPromise<string>
  abstract image(prompt: string, options?: ImageOptions): RpcPromise<ImageResult>
  abstract video(prompt: string, options?: VideoOptions): RpcPromise<VideoResult>
  abstract write(prompt: string, options?: WriteOptions): RpcPromise<string>
  abstract list(prompt: string): RpcPromise<ListResult>
  abstract lists(prompt: string): RpcPromise<ListsResult>
}

/**
 * Standalone function for defining AI functions
 *
 * @example
 * ```ts
 * import { defineFunction } from 'ai-functions'
 *
 * const summarize = defineFunction({
 *   type: 'generative',
 *   name: 'summarize',
 *   args: { text: 'Text to summarize' },
 *   output: 'string',
 *   promptTemplate: 'Summarize: {{text}}',
 * })
 *
 * const result = await summarize.call({ text: 'Long article...' })
 * ```
 */
export function defineFunction<TArgs, TReturn>(
  definition: FunctionDefinition<TArgs, TReturn>
): DefinedFunction<TArgs, TReturn> {
  return createDefinedFunction(definition)
}

// ============================================================================
// Function Registry
// ============================================================================

/**
 * In-memory function registry
 */
class InMemoryFunctionRegistry implements FunctionRegistry {
  private functions = new Map<string, DefinedFunction>()

  get(name: string): DefinedFunction | undefined {
    return this.functions.get(name)
  }

  set(name: string, fn: DefinedFunction): void {
    this.functions.set(name, fn)
  }

  has(name: string): boolean {
    return this.functions.has(name)
  }

  list(): string[] {
    return Array.from(this.functions.keys())
  }

  delete(name: string): boolean {
    return this.functions.delete(name)
  }

  clear(): void {
    this.functions.clear()
  }
}

/**
 * Global function registry
 *
 * Note: This is in-memory only. For persistence, use mdxai or mdxdb packages.
 */
export const functions: FunctionRegistry = new InMemoryFunctionRegistry()

// ============================================================================
// Auto-Define Functions
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
    returnType: analysis.returnType as SimpleSchemaType,
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
        instructions: analysis.instructions || `Please review and respond to this ${readableName} request`,
        promptTemplate: analysis.promptTemplate,
      }
      break

    case 'generative':
    default:
      definition = {
        ...baseDefinition,
        type: 'generative' as const,
        output: (analysis.output || 'object') as 'string' | 'object' | 'image' | 'video' | 'audio',
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
function inferArgsSchema(args: Record<string, unknown>): Record<string, string | string[] | Record<string, unknown>> {
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
  code: <TArgs, TReturn>(
    definition: Omit<CodeFunctionDefinition<TArgs, TReturn>, 'type'>
  ): DefinedFunction<TArgs, TReturn> => {
    const fn = defineFunction({ type: 'code', ...definition } as CodeFunctionDefinition<TArgs, TReturn>)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define a generative function
   */
  generative: <TArgs, TReturn>(
    definition: Omit<GenerativeFunctionDefinition<TArgs, TReturn>, 'type'>
  ): DefinedFunction<TArgs, TReturn> => {
    const fn = defineFunction({ type: 'generative', ...definition } as GenerativeFunctionDefinition<TArgs, TReturn>)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define an agentic function
   */
  agentic: <TArgs, TReturn>(
    definition: Omit<AgenticFunctionDefinition<TArgs, TReturn>, 'type'>
  ): DefinedFunction<TArgs, TReturn> => {
    const fn = defineFunction({ type: 'agentic', ...definition } as AgenticFunctionDefinition<TArgs, TReturn>)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },

  /**
   * Define a human-in-the-loop function
   */
  human: <TArgs, TReturn>(
    definition: Omit<HumanFunctionDefinition<TArgs, TReturn>, 'type'>
  ): DefinedFunction<TArgs, TReturn> => {
    const fn = defineFunction({ type: 'human', ...definition } as HumanFunctionDefinition<TArgs, TReturn>)
    functions.set(definition.name, fn as DefinedFunction)
    return fn
  },
})

// ============================================================================
// AI() - Smart AI Client with Auto-Definition
// ============================================================================

/** Known built-in method names that should not be auto-defined */
const BUILTIN_METHODS = new Set([
  'do', 'is', 'code', 'decide', 'diagram', 'generate', 'image', 'video', 'write', 'list', 'lists',
  'functions', 'define', 'defineFunction', 'then', 'catch', 'finally',
])

/**
 * Create a smart AI client that auto-defines functions on first call
 *
 * @example
 * ```ts
 * const ai = AI()
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
function createSmartAI(): AIProxy {
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
 * Default AI instance with auto-define capability
 *
 * @example
 * ```ts
 * import { ai } from 'ai-functions'
 *
 * // Auto-define and call
 * const result = await ai.summarize({ text: 'Long article...' })
 *
 * // Access functions registry
 * ai.functions.list()
 *
 * // Define explicitly
 * ai.define.generative({ name: 'translate', ... })
 * ```
 */
export const ai: AIProxy = createSmartAI()
