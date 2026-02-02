/**
 * Function Registry - Storage and management of defined AI functions
 *
 * This module provides the registry for storing and retrieving defined functions,
 * including the global registry and factory for creating isolated registries.
 */

import { generateObject } from './generate.js'
import type { SimpleSchema } from './schema.js'
import type {
  AIFunctionDefinition,
  JSONSchema,
  FunctionDefinition,
  DefinedFunction,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
  HumanFunctionPending,
  FunctionRegistry,
} from './types.js'
import { PENDING_HUMAN_RESULT_SYMBOL } from './types.js'
import { schema as convertSchema, type SimpleSchema as SimpleSchemaType } from './schema.js'
import { getLogger } from './logger.js'

// ============================================================================
// JSON Schema Conversion
// ============================================================================

/**
 * Convert args schema to JSON Schema
 */
export function convertArgsToJSONSchema(args: unknown): JSONSchema {
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

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Fill template with values
 */
export function fillTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(args[key] ?? ''))
}

// ============================================================================
// Function Executors
// ============================================================================

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
  const { name, description, language = 'typescript', instructions } = definition
  const model =
    'model' in definition ? (definition as { model?: string }).model ?? 'sonnet' : 'sonnet'

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
        prompt,
        ...(system !== undefined && { system }),
        ...(temperature !== undefined && { temperature }),
      })
      return (result.object as { text: string }).text as TOutput
    }

    case 'object': {
      const objectSchema = returnType || { result: 'The generated result' }
      const result = await generateObject({
        model,
        schema: objectSchema as SimpleSchemaType,
        prompt,
        ...(system !== undefined && { system }),
        ...(temperature !== undefined && { temperature }),
      })
      return result.object as TOutput
    }

    case 'image':
      throw new Error(
        'Image generation via generative functions is not yet implemented. ' +
          'Use the image() primitive directly instead.'
      )

    case 'video':
      throw new Error(
        'Video generation via generative functions is not yet implemented. ' +
          'Use the video() primitive directly instead.'
      )

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
    schema: uiSchema[channel] ?? uiSchema['custom'],
    system: `Generate ${channel} UI/content for a human-in-the-loop task.`,
    prompt: `Task: ${instructions}

Input data:
${prompt}

Expected response format:
${JSON.stringify(returnType)}

Generate the appropriate ${channel} UI/content to collect this response from a human.`,
  })

  // Runtime warning for developers
  getLogger().warn(
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

// ============================================================================
// Defined Function Creation
// ============================================================================

/**
 * Create a defined function from a function definition
 */
export function createDefinedFunction<TOutput, TInput>(
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
// Function Registry Implementation
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
