/**
 * DigitalObjectsFunctionRegistry - Persistent function registry using digital-objects
 *
 * This implementation stores function definitions as Things and function calls as Actions,
 * providing full persistence and audit trail capabilities.
 *
 * Nouns:
 * - CodeFunction: Functions that generate executable code
 * - GenerativeFunction: Functions that use AI to generate content
 * - AgenticFunction: Functions that run in a loop with tools
 * - HumanFunction: Functions that require human input/approval
 *
 * Verbs:
 * - define: Function definition action
 * - call: Function invocation action
 * - complete: Successful completion action
 * - fail: Failed execution action
 *
 * @packageDocumentation
 */

import type { DigitalObjectsProvider, Thing, Action } from 'digital-objects'

import type {
  FunctionRegistry,
  DefinedFunction,
  FunctionDefinition,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
} from './types.js'

/**
 * Noun names for function types
 */
export const FUNCTION_NOUNS = {
  CODE: 'CodeFunction',
  GENERATIVE: 'GenerativeFunction',
  AGENTIC: 'AgenticFunction',
  HUMAN: 'HumanFunction',
} as const

/**
 * Verb names for function actions
 */
export const FUNCTION_VERBS = {
  DEFINE: 'define',
  CALL: 'call',
  COMPLETE: 'complete',
  FAIL: 'fail',
} as const

/**
 * Stored function definition shape
 */
export interface StoredFunctionDefinition {
  name: string
  type: 'code' | 'generative' | 'agentic' | 'human'
  description?: string
  args: unknown
  returnType?: unknown
  // Type-specific fields
  language?: string
  instructions?: string
  includeTests?: boolean
  includeExamples?: boolean
  output?: string
  system?: string
  promptTemplate?: string
  model?: string
  temperature?: number
  tools?: unknown[]
  maxIterations?: number
  stream?: boolean
  channel?: string
  timeout?: number
  assignee?: string
}

/**
 * Function call data stored in actions
 */
export interface FunctionCallData {
  args: unknown
  result?: unknown
  error?: string
  duration?: number
}

/**
 * Options for creating a DigitalObjectsFunctionRegistry
 */
export interface DigitalObjectsRegistryOptions {
  /** The digital-objects provider to use for storage */
  provider: DigitalObjectsProvider
  /** Whether to auto-initialize nouns and verbs (default: true) */
  autoInitialize?: boolean
}

/**
 * Map function type to noun name
 */
function typeToNoun(type: FunctionDefinition['type']): string {
  switch (type) {
    case 'code':
      return FUNCTION_NOUNS.CODE
    case 'generative':
      return FUNCTION_NOUNS.GENERATIVE
    case 'agentic':
      return FUNCTION_NOUNS.AGENTIC
    case 'human':
      return FUNCTION_NOUNS.HUMAN
  }
}

/**
 * Convert a FunctionDefinition to storable data
 */
function definitionToData(definition: FunctionDefinition): StoredFunctionDefinition {
  const base: StoredFunctionDefinition = {
    name: definition.name,
    type: definition.type,
    ...(definition.description !== undefined && { description: definition.description }),
    args: definition.args,
    ...(definition.returnType !== undefined && { returnType: definition.returnType }),
  }

  switch (definition.type) {
    case 'code': {
      const codeDef = definition as CodeFunctionDefinition
      return {
        ...base,
        ...(codeDef.language !== undefined && { language: codeDef.language }),
        ...(codeDef.instructions !== undefined && { instructions: codeDef.instructions }),
        ...(codeDef.includeTests !== undefined && { includeTests: codeDef.includeTests }),
        ...(codeDef.includeExamples !== undefined && { includeExamples: codeDef.includeExamples }),
      }
    }
    case 'generative': {
      const genDef = definition as GenerativeFunctionDefinition
      return {
        ...base,
        ...(genDef.output !== undefined && { output: genDef.output }),
        ...(genDef.system !== undefined && { system: genDef.system }),
        ...(genDef.promptTemplate !== undefined && { promptTemplate: genDef.promptTemplate }),
        ...(genDef.model !== undefined && { model: genDef.model }),
        ...(genDef.temperature !== undefined && { temperature: genDef.temperature }),
      }
    }
    case 'agentic': {
      const agentDef = definition as AgenticFunctionDefinition
      return {
        ...base,
        instructions: agentDef.instructions,
        ...(agentDef.promptTemplate !== undefined && { promptTemplate: agentDef.promptTemplate }),
        ...(agentDef.tools !== undefined && { tools: agentDef.tools }),
        ...(agentDef.maxIterations !== undefined && { maxIterations: agentDef.maxIterations }),
        ...(agentDef.model !== undefined && { model: agentDef.model }),
        ...(agentDef.stream !== undefined && { stream: agentDef.stream }),
      }
    }
    case 'human': {
      const humanDef = definition as HumanFunctionDefinition
      return {
        ...base,
        ...(humanDef.channel !== undefined && { channel: humanDef.channel }),
        instructions: humanDef.instructions,
        ...(humanDef.promptTemplate !== undefined && { promptTemplate: humanDef.promptTemplate }),
        ...(humanDef.timeout !== undefined && { timeout: humanDef.timeout }),
        ...(humanDef.assignee !== undefined && { assignee: humanDef.assignee }),
      }
    }
  }
}

/**
 * Convert stored data back to a FunctionDefinition
 */
function dataToDefinition(data: StoredFunctionDefinition): FunctionDefinition {
  switch (data.type) {
    case 'code': {
      const def = {
        type: 'code' as const,
        name: data.name,
        args: data.args,
      } as CodeFunctionDefinition
      if (data.description !== undefined)
        (def as { description: string }).description = data.description
      if (data.returnType !== undefined)
        (def as { returnType: unknown }).returnType = data.returnType
      if (data.language !== undefined)
        (def as { language: CodeFunctionDefinition['language'] }).language =
          data.language as CodeFunctionDefinition['language']
      if (data.instructions !== undefined)
        (def as { instructions: string }).instructions = data.instructions
      if (data.includeTests !== undefined)
        (def as { includeTests: boolean }).includeTests = data.includeTests
      if (data.includeExamples !== undefined)
        (def as { includeExamples: boolean }).includeExamples = data.includeExamples
      return def
    }
    case 'generative': {
      const def: GenerativeFunctionDefinition = {
        type: 'generative',
        name: data.name,
        args: data.args,
        output: (data.output ?? 'string') as GenerativeFunctionDefinition['output'],
      }
      if (data.description !== undefined) def.description = data.description
      if (data.returnType !== undefined) def.returnType = data.returnType
      if (data.system !== undefined) def.system = data.system
      if (data.promptTemplate !== undefined) def.promptTemplate = data.promptTemplate
      if (data.model !== undefined) def.model = data.model
      if (data.temperature !== undefined) def.temperature = data.temperature
      return def
    }
    case 'agentic': {
      const def = {
        type: 'agentic' as const,
        name: data.name,
        args: data.args,
        instructions: data.instructions ?? '',
      } as AgenticFunctionDefinition
      if (data.description !== undefined)
        (def as { description: string }).description = data.description
      if (data.returnType !== undefined)
        (def as { returnType: unknown }).returnType = data.returnType
      if (data.promptTemplate !== undefined)
        (def as { promptTemplate: string }).promptTemplate = data.promptTemplate
      if (data.tools !== undefined)
        (def as { tools: AgenticFunctionDefinition['tools'] }).tools =
          data.tools as AgenticFunctionDefinition['tools']
      if (data.maxIterations !== undefined)
        (def as { maxIterations: number }).maxIterations = data.maxIterations
      if (data.model !== undefined) (def as { model: string }).model = data.model
      if (data.stream !== undefined) (def as { stream: boolean }).stream = data.stream
      return def
    }
    case 'human': {
      const def: HumanFunctionDefinition = {
        type: 'human',
        name: data.name,
        args: data.args,
        channel: (data.channel ?? 'web') as HumanFunctionDefinition['channel'],
        instructions: data.instructions ?? '',
      }
      if (data.description !== undefined) def.description = data.description
      if (data.returnType !== undefined) def.returnType = data.returnType
      if (data.promptTemplate !== undefined) def.promptTemplate = data.promptTemplate
      if (data.timeout !== undefined) def.timeout = data.timeout
      if (data.assignee !== undefined) def.assignee = data.assignee
      return def
    }
  }
}

/**
 * DigitalObjectsFunctionRegistry - Persistent function registry using digital-objects
 *
 * This class implements the FunctionRegistry interface using digital-objects for storage.
 * Function definitions are stored as Things, and function calls are tracked as Actions.
 *
 * @example
 * ```ts
 * import { createMemoryProvider } from 'digital-objects'
 * import { createDigitalObjectsRegistry, defineFunction } from 'ai-functions'
 *
 * const provider = createMemoryProvider()
 * const registry = await createDigitalObjectsRegistry({ provider })
 *
 * // Define a function
 * const summarize = defineFunction({
 *   type: 'generative',
 *   name: 'summarize',
 *   args: { text: 'Text to summarize' },
 *   output: 'string',
 * })
 *
 * // Store it in the registry
 * registry.set('summarize', summarize)
 *
 * // Later, retrieve it
 * const fn = registry.get('summarize')
 * if (fn) {
 *   const result = await fn.call({ text: 'Long article...' })
 * }
 * ```
 */
export class DigitalObjectsFunctionRegistry implements FunctionRegistry {
  private provider: DigitalObjectsProvider
  private initialized = false
  private autoInitialize: boolean
  private initPromise: Promise<void> | null = null

  // In-memory cache for DefinedFunction instances (they contain the call implementation)
  private functionCache = new Map<string, DefinedFunction>()

  constructor(options: DigitalObjectsRegistryOptions) {
    this.provider = options.provider
    this.autoInitialize = options.autoInitialize ?? true
  }

  /**
   * Initialize the registry by defining all necessary nouns and verbs
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._initialize()
    await this.initPromise
    this.initialized = true
  }

  private async _initialize(): Promise<void> {
    // Define function type nouns
    await Promise.all([
      this.provider.defineNoun({
        name: FUNCTION_NOUNS.CODE,
        description: 'Function that generates executable code',
        schema: {
          name: 'string',
          description: 'string?',
          language: 'string?',
          instructions: 'string?',
        },
      }),
      this.provider.defineNoun({
        name: FUNCTION_NOUNS.GENERATIVE,
        description: 'Function that uses AI to generate content',
        schema: {
          name: 'string',
          description: 'string?',
          output: 'string',
          system: 'string?',
          promptTemplate: 'string?',
        },
      }),
      this.provider.defineNoun({
        name: FUNCTION_NOUNS.AGENTIC,
        description: 'Function that runs in a loop with tools',
        schema: {
          name: 'string',
          description: 'string?',
          instructions: 'string',
          maxIterations: 'number?',
        },
      }),
      this.provider.defineNoun({
        name: FUNCTION_NOUNS.HUMAN,
        description: 'Function that requires human input or approval',
        schema: {
          name: 'string',
          description: 'string?',
          channel: 'string',
          instructions: 'string',
        },
      }),
    ])

    // Define function action verbs
    await Promise.all([
      this.provider.defineVerb({
        name: FUNCTION_VERBS.DEFINE,
        description: 'Define a new function',
      }),
      this.provider.defineVerb({
        name: FUNCTION_VERBS.CALL,
        description: 'Call/invoke a function',
      }),
      this.provider.defineVerb({
        name: FUNCTION_VERBS.COMPLETE,
        description: 'Mark a function call as successfully completed',
      }),
      this.provider.defineVerb({
        name: FUNCTION_VERBS.FAIL,
        description: 'Mark a function call as failed',
      }),
    ])
  }

  /**
   * Ensure the registry is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.autoInitialize && !this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Get a function by name
   */
  get(name: string): DefinedFunction | undefined {
    // Return from cache if available
    return this.functionCache.get(name)
  }

  /**
   * Get a function by name (async version for loading from storage)
   */
  async getAsync(name: string): Promise<DefinedFunction | undefined> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.functionCache.get(name)
    if (cached) return cached

    // Search across all function nouns
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.find<StoredFunctionDefinition>(noun, { name })
      const firstThing = things[0]
      if (firstThing) {
        const definition = dataToDefinition(firstThing.data)
        // Note: The caller needs to provide the call implementation
        // This returns the definition info but not a callable function
        return {
          definition,
          call: async () => {
            throw new Error(
              `Function '${name}' was loaded from storage but has no call implementation. ` +
                'Use defineFunction() to create a callable function.'
            )
          },
          asTool: () => ({
            name: definition.name,
            description: definition.description ?? `Execute ${definition.name}`,
            parameters: { type: 'object', properties: {}, required: [] },
            handler: async () => {
              throw new Error('Function loaded from storage is not callable')
            },
          }),
        }
      }
    }

    return undefined
  }

  /**
   * Store a function definition
   */
  set(name: string, fn: DefinedFunction): void {
    // Store in cache for immediate access
    this.functionCache.set(name, fn)

    // Store in digital-objects asynchronously (fire and forget for sync interface)
    this.setAsync(name, fn).catch((err) => {
      console.error(`Failed to persist function '${name}' to digital-objects:`, err)
    })
  }

  /**
   * Store a function definition (async version)
   */
  async setAsync(name: string, fn: DefinedFunction): Promise<Thing<StoredFunctionDefinition>> {
    await this.ensureInitialized()

    const definition = fn.definition
    const noun = typeToNoun(definition.type)
    const data = definitionToData(definition)

    // Check if function already exists
    const existing = await this.provider.find<StoredFunctionDefinition>(noun, { name })
    const existingThing = existing[0]

    let thing: Thing<StoredFunctionDefinition>
    if (existingThing) {
      // Update existing
      thing = await this.provider.update<StoredFunctionDefinition>(existingThing.id, data)
    } else {
      // Create new
      thing = await this.provider.create<StoredFunctionDefinition>(noun, data)

      // Record the define action
      await this.provider.perform(
        FUNCTION_VERBS.DEFINE,
        undefined, // subject (could be user ID in future)
        thing.id,
        { name, type: definition.type }
      )
    }

    // Update cache
    this.functionCache.set(name, fn)

    return thing
  }

  /**
   * Check if a function exists
   */
  has(name: string): boolean {
    return this.functionCache.has(name)
  }

  /**
   * Check if a function exists (async version that also checks storage)
   */
  async hasAsync(name: string): Promise<boolean> {
    if (this.functionCache.has(name)) return true

    await this.ensureInitialized()

    // Search across all function nouns
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.find<StoredFunctionDefinition>(noun, { name })
      if (things.length > 0) return true
    }

    return false
  }

  /**
   * List all function names
   */
  list(): string[] {
    return Array.from(this.functionCache.keys())
  }

  /**
   * List all function names (async version that includes storage)
   */
  async listAsync(): Promise<string[]> {
    await this.ensureInitialized()

    const names = new Set<string>(this.functionCache.keys())

    // Get all functions from storage
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.list<StoredFunctionDefinition>(noun)
      for (const thing of things) {
        names.add(thing.data.name)
      }
    }

    return Array.from(names)
  }

  /**
   * Delete a function
   */
  delete(name: string): boolean {
    const existed = this.functionCache.has(name)
    this.functionCache.delete(name)

    // Delete from storage asynchronously
    this.deleteAsync(name).catch((err) => {
      console.error(`Failed to delete function '${name}' from digital-objects:`, err)
    })

    return existed
  }

  /**
   * Delete a function (async version)
   */
  async deleteAsync(name: string): Promise<boolean> {
    await this.ensureInitialized()

    this.functionCache.delete(name)

    // Search across all function nouns and delete
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.find<StoredFunctionDefinition>(noun, { name })
      for (const thing of things) {
        await this.provider.delete(thing.id)
      }
      if (things.length > 0) return true
    }

    return false
  }

  /**
   * Clear all functions
   */
  clear(): void {
    this.functionCache.clear()

    // Clear storage asynchronously
    this.clearAsync().catch((err) => {
      console.error('Failed to clear functions from digital-objects:', err)
    })
  }

  /**
   * Clear all functions (async version)
   */
  async clearAsync(): Promise<void> {
    await this.ensureInitialized()

    this.functionCache.clear()

    // Delete all functions from storage
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.list<StoredFunctionDefinition>(noun)
      for (const thing of things) {
        await this.provider.delete(thing.id)
      }
    }
  }

  // ============================================================================
  // Function Call Tracking (Actions)
  // ============================================================================

  /**
   * Record a function call as an Action
   */
  async trackCall(functionName: string, args: unknown): Promise<Action<FunctionCallData>> {
    await this.ensureInitialized()

    // Find the function thing
    let functionId: string | undefined
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.find<StoredFunctionDefinition>(noun, {
        name: functionName,
      })
      const firstThing = things[0]
      if (firstThing) {
        functionId = firstThing.id
        break
      }
    }

    return this.provider.perform<FunctionCallData>(
      FUNCTION_VERBS.CALL,
      undefined, // subject (caller)
      functionId, // object (the function)
      { args }
    )
  }

  /**
   * Record a successful function completion
   */
  async trackCompletion(
    callActionId: string,
    result: unknown,
    duration?: number
  ): Promise<Action<FunctionCallData>> {
    await this.ensureInitialized()

    const data: FunctionCallData = { args: undefined, result }
    if (duration !== undefined) data.duration = duration
    return this.provider.perform<FunctionCallData>(
      FUNCTION_VERBS.COMPLETE,
      undefined,
      callActionId,
      data
    )
  }

  /**
   * Record a function failure
   */
  async trackFailure(
    callActionId: string,
    error: string,
    duration?: number
  ): Promise<Action<FunctionCallData>> {
    await this.ensureInitialized()

    const data: FunctionCallData = { args: undefined, error }
    if (duration !== undefined) data.duration = duration
    return this.provider.perform<FunctionCallData>(
      FUNCTION_VERBS.FAIL,
      undefined,
      callActionId,
      data
    )
  }

  /**
   * Get call history for a function
   */
  async getCallHistory(functionName: string): Promise<Action<FunctionCallData>[]> {
    await this.ensureInitialized()

    // Find the function thing
    for (const noun of Object.values(FUNCTION_NOUNS)) {
      const things = await this.provider.find<StoredFunctionDefinition>(noun, {
        name: functionName,
      })
      const firstThing = things[0]
      if (firstThing) {
        return this.provider.listActions<FunctionCallData>({
          verb: FUNCTION_VERBS.CALL,
          object: firstThing.id,
        })
      }
    }

    return []
  }

  /**
   * Get all recent function calls
   */
  async getRecentCalls(limit = 10): Promise<Action<FunctionCallData>[]> {
    await this.ensureInitialized()

    return this.provider.listActions<FunctionCallData>({
      verb: FUNCTION_VERBS.CALL,
      limit,
    })
  }

  /**
   * Get the underlying provider for advanced operations
   */
  getProvider(): DigitalObjectsProvider {
    return this.provider
  }
}

/**
 * Create a DigitalObjectsFunctionRegistry
 *
 * @param options - Configuration options including the provider
 * @returns An initialized DigitalObjectsFunctionRegistry
 *
 * @example
 * ```ts
 * import { createMemoryProvider } from 'digital-objects'
 * import { createDigitalObjectsRegistry } from 'ai-functions'
 *
 * const provider = createMemoryProvider()
 * const registry = await createDigitalObjectsRegistry({ provider })
 *
 * // Use the registry
 * registry.set('myFunc', definedFunction)
 * const fn = registry.get('myFunc')
 * ```
 */
export async function createDigitalObjectsRegistry(
  options: DigitalObjectsRegistryOptions
): Promise<DigitalObjectsFunctionRegistry> {
  const registry = new DigitalObjectsFunctionRegistry(options)
  if (options.autoInitialize !== false) {
    await registry.initialize()
  }
  return registry
}
