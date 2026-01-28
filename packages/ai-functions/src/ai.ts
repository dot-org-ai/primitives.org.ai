/**
 * AI() and ai() - Core AI function constructors
 *
 * These provide the main entry points for AI-powered functions,
 * with full RPC promise pipelining support via rpc.do.
 */

// TODO: Re-enable RPC imports when rpc.do is published
// import { RPC, http, ws, type RPCProxy, type RPCPromise as RpcPromiseType } from 'rpc.do'

/**
 * Base class for RPC service targets
 * This is a placeholder for services that want to expose methods over RPC
 */
export abstract class RpcTarget {
  // Subclasses implement methods that will be exposed over RPC
}

/**
 * Options for RPC session (connection to remote AI service)
 */
export interface RPCSessionOptions {
  /** WebSocket URL for RPC connection */
  wsUrl?: string
  /** HTTP URL for RPC fallback */
  httpUrl?: string
  /** Authentication token */
  token?: string
}
import { generateObject } from './generate.js'
import type { SimpleSchema } from './schema.js'
import type { LanguageModel } from 'ai'
import { PENDING_HUMAN_RESULT_SYMBOL } from './types.js'
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
  HumanFunctionPending,
  HumanChannel,
  CodeLanguage,
  FunctionRegistry,
  AutoDefineResult,
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
  [K in keyof T]: (
    prompt?: string,
    options?: AISchemaOptions
  ) => Promise<InferSimpleSchemaResult<T[K]>>
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
export function AI(
  options: AIClientOptions
): AIClient & Record<string, (...args: unknown[]) => Promise<unknown>>

export function AI<T extends Record<string, SimpleSchema>>(
  schemasOrOptions: T | AIClientOptions,
  defaultOptions?: AISchemaOptions
): SchemaFunctions<T> | (AIClient & Record<string, (...args: unknown[]) => Promise<unknown>>) {
  // Check if this is RPC client mode
  if (isAIClientOptions(schemasOrOptions)) {
    // TODO: Re-enable RPC client when rpc.do is published
    // const { model, temperature, maxTokens, functions, wsUrl, httpUrl, token } = schemasOrOptions
    //
    // // Create transport based on provided URLs
    // let transport
    // if (wsUrl) {
    //   transport = ws(wsUrl, token ? () => token : undefined)
    // } else if (httpUrl) {
    //   transport = http(httpUrl, token ? () => token : undefined)
    // } else {
    //   throw new Error('AI client requires either wsUrl or httpUrl')
    // }
    //
    // // Create RPC client
    // const rpcClient = RPC<AIClient>(transport)
    //
    // // Create a proxy that handles both defined methods and dynamic function calls
    // return new Proxy(rpcClient, {
    //   get(target, prop: string) {
    //     // Return existing methods
    //     if (prop in target) {
    //       return (target as unknown as Record<string, unknown>)[prop]
    //     }
    //
    //     // Handle dynamic function calls (ai.functionName())
    //     return (...args: unknown[]) => {
    //       const client = target as unknown as AIClient
    //       return client.do(prop, args.length === 1 ? args[0] : args)
    //     }
    //   }
    // }) as AIClient & Record<string, (...args: unknown[]) => Promise<unknown>>
    throw new Error(
      'RPC client mode requires rpc.do package (not yet published). Use schema-based mode instead.'
    )
  }

  // Schema functions mode - create a function for each schema
  return createSchemaFunctions(
    schemasOrOptions as Record<string, SimpleSchema>,
    defaultOptions
  ) as SchemaFunctions<T>
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
  const functions: Record<
    string,
    (prompt?: string, options?: AISchemaOptions) => Promise<unknown>
  > = {}

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
    return (schema[0] as string) || 'Generate items'
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
function createDefinedFunction<TOutput, TInput>(
  definition: FunctionDefinition<TOutput, TInput>
): DefinedFunction<TOutput, TInput> {
  const call = async (args: TInput): Promise<TOutput> => {
    switch (definition.type) {
      case 'code':
        return executeCodeFunction(definition, args) as Promise<TOutput>
      case 'generative':
        return executeGenerativeFunction(definition, args) as Promise<TOutput>
      case 'agentic':
        return executeAgenticFunction(definition, args) as Promise<TOutput>
      case 'human':
        return executeHumanFunction(definition, args) as Promise<TOutput>
      default:
        throw new Error(`Unknown function type: ${(definition as FunctionDefinition).type}`)
    }
  }

  const asTool = (): AIFunctionDefinition<TOutput, TInput> => {
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
      const options = value.split(' | ').map((s) => s.trim())
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
 * Execute a code function - generates code based on specification
 *
 * Returns just the generated code string. For access to additional metadata
 * like tests, examples, and documentation, use the full CodeFunctionResult type
 * by defining a custom function.
 */
async function executeCodeFunction<TInput>(
  definition: CodeFunctionDefinition<unknown, TInput>,
  args: TInput
): Promise<string> {
  const { name, description, language = 'typescript', instructions, model = 'sonnet' } = definition

  const argsDescription = JSON.stringify(args, null, 2)

  const result = await generateObject({
    model,
    schema: {
      code: `The complete ${language} implementation code. Output ONLY the raw code without markdown formatting or code blocks.`,
    },
    system: `You are an expert ${language} developer. Generate clean, well-documented, production-ready code. Output ONLY the code itself, without any markdown code fences or language tags.`,
    prompt: `Generate a ${language} function/query with the following specification:

Name: ${name}
Description: ${description || 'No description provided'}
Arguments: ${argsDescription}
Return Type: ${JSON.stringify(definition.returnType)}

${instructions ? `Additional Instructions: ${instructions}` : ''}

Requirements:
- Include appropriate comments/documentation
- Follow best practices for ${language}
- Handle edge cases appropriately
- Return ONLY the code without markdown formatting`,
  })

  const obj = result.object as { code: string }
  // Return just the code string
  return obj.code
}

/**
 * Execute a generative function - uses AI to generate content
 */
async function executeGenerativeFunction<TOutput, TInput>(
  definition: GenerativeFunctionDefinition<TOutput, TInput>,
  args: TInput
): Promise<TOutput> {
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
      return (result.object as { text: string }).text as TOutput
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
      return result.object as TOutput
    }

    case 'image': {
      const client = getDefaultAIClient()
      // Cast required: client.image() returns ImageResult but TOutput is determined by the
      // output parameter at runtime. TypeScript can't narrow TOutput based on output='image'.
      return client.image(prompt) as unknown as Promise<TOutput>
    }

    case 'video': {
      const client = getDefaultAIClient()
      // Cast required: client.video() returns VideoResult but TOutput is determined by the
      // output parameter at runtime. TypeScript can't narrow TOutput based on output='video'.
      return client.video(prompt) as unknown as Promise<TOutput>
    }

    default:
      throw new Error(`Unknown output type: ${output}`)
  }
}

/**
 * Execute an agentic function - runs in a loop with tools
 */
async function executeAgenticFunction<TOutput, TInput>(
  definition: AgenticFunctionDefinition<TOutput, TInput>,
  args: TInput
): Promise<TOutput> {
  const {
    instructions,
    promptTemplate,
    tools = [],
    maxIterations = 10,
    model = 'sonnet',
    returnType,
  } = definition

  const prompt = promptTemplate
    ? fillTemplate(promptTemplate, args as Record<string, unknown>)
    : JSON.stringify(args)

  // Build system prompt with tool descriptions
  const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')
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
      return response.finalResult as TOutput
    }

    // Execute tool call
    const tool = tools.find((t) => t.name === response.toolCall.name)
    if (tool) {
      let toolArgs: Record<string, unknown>
      try {
        toolArgs = JSON.parse(response.toolCall.arguments || '{}')
      } catch (e) {
        toolResults.push({
          error: `Invalid tool arguments: ${(e as Error).message}`,
        })
        continue
      }
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
 *
 * **Note: This function currently returns a pending placeholder.**
 *
 * In a complete implementation, this function would:
 * 1. Generate channel-specific UI (Slack blocks, email templates, web forms, etc.)
 * 2. Send the generated UI to the appropriate channel
 * 3. Wait for human response with optional timeout
 * 4. Validate and return the human's response
 *
 * The current implementation generates the UI artifacts but returns a pending
 * placeholder instead of actually sending to the channel and waiting for response.
 * This allows testing the UI generation without requiring actual channel integrations.
 *
 * **Important:** Use `isPendingHumanResult()` to check if the result is pending
 * before attempting to use it as the expected output type.
 *
 * @param definition - The human function definition with channel and instructions
 * @param args - Arguments to pass to the function
 * @returns Either the actual TOutput from human input, or a HumanFunctionPending placeholder
 *
 * @example
 * ```ts
 * import { isPendingHumanResult } from 'ai-functions'
 *
 * const result = await approveRefund({ amount: 500 })
 *
 * if (isPendingHumanResult(result)) {
 *   // Handle pending state
 *   console.log('Awaiting human approval via:', result.channel)
 *   return { status: 'pending' }
 * }
 *
 * // result is the actual approval response
 * console.log('Approved:', result.approved)
 * ```
 */
async function executeHumanFunction<TOutput, TInput>(
  definition: HumanFunctionDefinition<TOutput, TInput>,
  args: TInput
): Promise<TOutput | HumanFunctionPending<TOutput>> {
  const { channel, instructions, promptTemplate, returnType } = definition

  const prompt = promptTemplate
    ? fillTemplate(promptTemplate, args as Record<string, unknown>)
    : JSON.stringify(args)

  // Generate channel-specific UI
  const uiSchema: Record<string, SimpleSchemaType> = {
    // New HumanChannel types
    chat: {
      message: 'Chat message to send',
      options: ['Response options if applicable'],
    },
    email: {
      subject: 'Email subject',
      html: 'Email HTML body',
      text: 'Plain text fallback',
    },
    phone: {
      script: 'Phone call script',
      keyPoints: ['Key points to cover'],
    },
    sms: {
      text: 'SMS message text (max 160 chars)',
    },
    workspace: {
      blocks: ['Workspace/Slack BlockKit blocks as JSON array'],
      text: 'Plain text fallback',
    },
    web: {
      component: 'React component code for the form',
      schema: 'JSON schema for the form fields',
    },
    // Legacy fallback
    custom: {
      data: 'Structured data for custom implementation',
      instructions: 'Instructions for the human',
    },
  }

  const result = await generateObject({
    model: 'sonnet',
    schema: uiSchema[channel] ?? uiSchema.custom,
    system: `Generate ${channel} UI/content for a human-in-the-loop task.`,
    prompt: `Task: ${instructions}

Input data:
${prompt}

Expected response format:
${JSON.stringify(returnType)}

Generate the appropriate ${channel} UI/content to collect this response from a human.`,
  })

  // Runtime warning for developers
  console.warn(
    `[HumanFunction] Returning pending placeholder for channel '${channel}'. ` +
      `Use isPendingHumanResult() to check before using the result. ` +
      `Full channel integration is not yet implemented.`
  )

  // Return a properly typed pending result
  // The symbol marker allows isPendingHumanResult() to reliably identify this
  const pendingResult: HumanFunctionPending<TOutput> = {
    [PENDING_HUMAN_RESULT_SYMBOL]: true,
    _pending: true,
    channel,
    artifacts: result.object,
    expectedResponseType: returnType as TOutput,
  }

  return pendingResult
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
): ((prompt: string, ...args: TArgs) => TReturn) &
  ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn) {
  return function (promptOrStrings: string | TemplateStringsArray, ...args: unknown[]): TReturn {
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      // Tagged template literal call - pass empty args for optional params
      const strings = promptOrStrings as TemplateStringsArray
      const values = args
      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
      // Cast required: When called as a tagged template, additional args aren't provided.
      // TArgs represents optional parameters that default to empty. TypeScript can't express
      // that TArgs can be satisfied by an empty array when all elements are optional.
      return fn(prompt, ...([] as unknown as TArgs))
    }
    // Regular function call
    return fn(promptOrStrings as string, ...(args as TArgs))
  } as ((prompt: string, ...args: TArgs) => TReturn) &
    ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn)
}

// Default client management
let defaultClient: AIClient | null = null

/**
 * Configure the default AI client
 */
export function configureAI(options: AIClientOptions): void {
  defaultClient = AI(options) as AIClient
}

/**
 * Get the default AI client, throwing if not configured
 */
function getDefaultAIClient(): AIClient {
  if (!defaultClient) {
    // Try to auto-configure from environment
    const wsUrl = typeof process !== 'undefined' ? process.env?.AI_WS_URL : undefined
    const httpUrl = typeof process !== 'undefined' ? process.env?.AI_HTTP_URL : undefined

    if (wsUrl) {
      // Explicitly type the options to call the correct AI() overload.
      // Without this, TypeScript might incorrectly match the schema overload.
      const options: AIClientOptions = { wsUrl }
      defaultClient = AI(options)
    } else if (httpUrl) {
      // Explicitly type the options to call the correct AI() overload.
      const options: AIClientOptions = { httpUrl }
      defaultClient = AI(options)
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
  abstract generate(options: AIGenerateOptions): Promise<AIGenerateResult>
  abstract do(action: string, context?: unknown): Promise<unknown>
  abstract is(value: unknown, type: string | JSONSchema): Promise<boolean>
  abstract code(prompt: string, language?: string): Promise<string>
  abstract decide<T extends string>(options: T[], context?: string): Promise<T>
  abstract diagram(description: string, format?: 'mermaid' | 'svg' | 'ascii'): Promise<string>
  abstract image(prompt: string, options?: ImageOptions): Promise<ImageResult>
  abstract video(prompt: string, options?: VideoOptions): Promise<VideoResult>
  abstract write(prompt: string, options?: WriteOptions): Promise<string>
  abstract list(prompt: string): Promise<ListResult>
  abstract lists(prompt: string): Promise<ListsResult>
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
export function defineFunction<TOutput, TInput>(
  definition: FunctionDefinition<TOutput, TInput>
): DefinedFunction<TOutput, TInput> {
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
 * Factory function to create a new isolated function registry instance.
 *
 * Use this when you need:
 * - Test isolation: Each test can have its own registry
 * - Scoped registries: Different parts of an app can have separate registries
 * - Custom lifecycle management: Control when registries are created/destroyed
 *
 * @example
 * ```ts
 * // Create isolated registry for tests
 * const registry = createFunctionRegistry()
 * const fn = defineFunction({ ... })
 * registry.set('myFunc', fn)
 *
 * // Later, registry can be discarded without affecting global state
 * ```
 *
 * @returns A new FunctionRegistry instance
 */
export function createFunctionRegistry(): FunctionRegistry {
  return new InMemoryFunctionRegistry()
}

/**
 * Global function registry
 *
 * Note: This is in-memory only. For persistence, use mdxai or mdxdb packages.
 *
 * **Lifecycle:**
 * - Created once at module load time
 * - Shared across the entire application
 * - Use `resetGlobalRegistry()` in tests to clear state between test runs
 * - For isolated registries, use `createFunctionRegistry()` instead
 */
export const functions: FunctionRegistry = new InMemoryFunctionRegistry()

/**
 * Reset the global function registry to a clean state.
 *
 * **Important:** This is primarily intended for test cleanup to ensure
 * test isolation. In production code, prefer using `createFunctionRegistry()`
 * for isolated registries.
 *
 * @example
 * ```ts
 * // In test setup/teardown
 * beforeEach(() => {
 *   resetGlobalRegistry()
 * })
 *
 * // Or after each test
 * afterEach(() => {
 *   resetGlobalRegistry()
 * })
 * ```
 */
export function resetGlobalRegistry(): void {
  functions.clear()
}

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
// AI() - Smart AI Client with Auto-Definition
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
