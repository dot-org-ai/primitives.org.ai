/**
 * AI Proxy - Auto-define proxy functionality
 *
 * This module provides the smart AI proxy that can auto-define functions
 * on first call, and the `define` helper for explicitly defining functions.
 */

import { generateObject } from './generate.js'
import type { SimpleSchema as SimpleSchemaType } from './schema.js'
import type {
  FunctionDefinition,
  DefinedFunction,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
  HumanChannel,
  FunctionRegistry,
  AutoDefineResult,
} from './types.js'
import { functions, defineFunction, createDefinedFunction } from './function-registry.js'

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
