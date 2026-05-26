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
  CodeGenerationDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
  HumanFunctionPending,
  FunctionRegistry,
} from './types.js'
import { PENDING_HUMAN_RESULT_SYMBOL } from './types.js'
import { schema as convertSchema, type SimpleSchema as SimpleSchemaType } from './schema.js'
import { getLogger } from './logger.js'
import { runInSandbox, type SandboxEnv } from './sandbox.js'

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
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = args[key] ?? ''
    if (typeof v === 'object' && v !== null) {
      return JSON.stringify(v)
    }
    return String(v)
  })
}

// ============================================================================
// Function Executors
// ============================================================================

/**
 * Execute a **deterministic** code function.
 *
 * `Code` is the deterministic kind: no model is consulted at call time. This
 * invokes the definition's `handler` (canonical) or, if only an inline `code`
 * body was supplied, deterministically compiles and runs it. The result is
 * returned directly.
 *
 * This is a deliberate change from the previous behavior, where `type: 'code'`
 * LLM-generated source at call time. That code-*authoring* behavior now lives
 * in {@link generateAndRunCode} (and the `generate('code', …)` primitive), so
 * that `Code` can carry the "deterministic handler" contract consumers depend
 * on (ADR-0033). See the package README migration note.
 *
 * Inline `code` bodies are executed in ai-evaluate's V8-isolate sandbox — never
 * via `new Function`/`eval`. Execution stays deterministic: no model is ever
 * consulted on this path.
 *
 * @param env - Optional host Workers env (carrying `LOADER`) for the sandbox;
 *   when omitted the inline-code path falls back to the Miniflare-backed Node
 *   runtime. Ignored when a `handler` is supplied (direct call, no sandbox).
 *
 * @throws if neither `handler` nor `code` is provided, or if an inline `code`
 *   body is in a non-evaluable language.
 */
async function executeCodeFunction<TOutput, TInput>(
  definition: CodeFunctionDefinition<TOutput, TInput>,
  args: TInput,
  env?: SandboxEnv
): Promise<TOutput> {
  const { handler, code, language = 'typescript', name } = definition

  if (typeof handler === 'function') {
    return await handler(args)
  }

  if (typeof code === 'string' && code.length > 0) {
    return await runInlineCode<TOutput, TInput>(code, args, language, name, env)
  }

  throw new Error(
    `Code function '${name}' has no handler or inline code. ` +
      `'code' functions are deterministic and require a handler: (input) => output ` +
      `(or an inline 'code' body). To have a model *author* code instead, use ` +
      `generateAndRunCode() / generateCode() or define a 'generative' function.`
  )
}

/**
 * Deterministically run an inline `code` body for a Code function in the
 * ai-evaluate V8-isolate sandbox.
 *
 * The body is treated as a function whose `return` value is the result; the
 * parsed `args` are exposed as a top-level `args` binding inside the sandbox.
 * Only the JS/TS-compatible languages can be evaluated; other languages are
 * carried as metadata for an external runtime and are rejected here.
 *
 * No model is involved — the same body always produces the same behavior. This
 * replaces the former `new Function(...)` path: `new Function`/`eval` are
 * banned in this package (broken under Workers, unsandboxed under Node).
 *
 * Limitation: `args` are injected by JSON-serializing them into the sandbox
 * script (`JSON.parse(<json>)`), so only JSON-serializable inputs are
 * supported on the inline-`code` path. Pass a `handler` for non-serializable
 * inputs (functions, class instances, etc.).
 *
 * @param env - Optional host Workers env (carrying `LOADER`) for the sandbox;
 *   when omitted, runs against the Miniflare-backed Node runtime.
 */
async function runInlineCode<TOutput, TInput>(
  code: string,
  args: TInput,
  language: string,
  name: string,
  env?: SandboxEnv
): Promise<TOutput> {
  if (language !== 'typescript' && language !== 'javascript') {
    throw new Error(
      `Code function '${name}' has an inline 'code' body in language '${language}', ` +
        `which cannot be evaluated in the sandbox. Pass a 'handler' instead, or run it ` +
        `in an external deterministic runtime.`
    )
  }

  const body = /\breturn\b/.test(code) ? code : `return (${code})`

  // Inject args deterministically by serializing them into the sandbox script.
  // (JSON-serializable inputs only — see the doc comment.)
  let argsJson: string
  try {
    argsJson = JSON.stringify(args ?? null)
  } catch (e) {
    throw new Error(
      `Code function '${name}' received non-JSON-serializable args for its inline 'code' ` +
        `body: ${(e as Error).message}. Pass a 'handler' for non-serializable inputs.`
    )
  }

  const script = `const args = JSON.parse(${JSON.stringify(argsJson)});\n${body}`

  const result = await runInSandbox({ script }, env)

  if (result.success === false) {
    throw new Error(
      `Code function '${name}' failed in the sandbox: ${result.error ?? 'unknown error'}`
    )
  }

  return result.value as TOutput
}

/**
 * Author code with a model — the explicit, opt-in code-*generation* path.
 *
 * This is the behavior `type: 'code'` used to have implicitly at call time.
 * It has been split out so that `Code` functions can be deterministic. Calling
 * this **does** consult a model and returns the generated source as a string;
 * it does not produce a deterministic, repeatable handler.
 *
 * @param definition - The code-authoring spec ({@link CodeGenerationDefinition})
 * @param args - Concrete inputs / refinements for the requested code
 * @returns The generated source code as a string
 *
 * @example
 * ```ts
 * import { generateCode } from 'ai-functions'
 *
 * const src = await generateCode(
 *   { name: 'calculateTax', args: { amount: '(number)', rate: '(number)' }, language: 'typescript' },
 *   { amount: 100, rate: 0.2 }
 * )
 * ```
 */
export async function generateCode<TInput>(
  definition: CodeGenerationDefinition<TInput>,
  args?: TInput
): Promise<string> {
  const {
    name,
    description,
    language = 'typescript',
    instructions,
    returnType,
    model = 'sonnet',
  } = definition

  const argsDescription = JSON.stringify(args ?? definition.args, null, 2)

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
Return Type: ${JSON.stringify(returnType)}

${instructions ? `Additional Instructions: ${instructions}` : ''}

Requirements:
- Include appropriate comments/documentation
- Follow best practices for ${language}
- Handle edge cases appropriately
- Return ONLY the code without markdown formatting`,
  })

  return (result.object as { code: string }).code
}

/**
 * Result of {@link generateAndRunCode}: the executed value plus the artifacts
 * that produced it.
 */
export interface GeneratedCodeRunResult<TOutput = unknown> {
  /** The value returned by running the authored code against the inputs. */
  value: TOutput
  /** The model-authored module source that was executed. */
  code: string
  /** The model-authored test source, if tests were requested. */
  tests?: string
  /** Test results, if tests ran in the sandbox. */
  testResults?: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  /** Console logs captured during execution. */
  logs: { level: string; message: string }[]
}

/**
 * The **non-deterministic** generate → run → test → return capability.
 *
 * This is the headline of the `generate('code', …)` primitive: a model
 * **authors** code, that code is **run** in ai-evaluate's V8-isolate sandbox,
 * optionally **tested** there, and the executed **result** is returned (not
 * just the source). This is deliberately separate from `type: 'code'`, which is
 * deterministic and never consults a model — so determinism is never blurred.
 *
 * Unlike {@link generateCode} (which only returns source text), this runs the
 * authored code. The authored module is expected to `export function ${name}`
 * (a NAMED export — the sandbox's module loader does not support `export
 * default`); the sandbox script invokes `${name}(args)` and returns its result.
 *
 * @param definition - The code-authoring spec ({@link CodeGenerationDefinition}).
 *   Set `includeTests: false` to skip test authoring (default: tests included).
 * @param args - Concrete inputs the authored code is invoked with.
 * @param env - Optional host Workers env. When it carries `LOADER` **and**
 *   `TEST`, tests run on the real Dynamic Workers loader; otherwise execution
 *   falls back to the Miniflare-backed Node runtime (whose dev worker has its
 *   own embedded test runner and needs no live `TEST` binding).
 * @returns The executed result plus authored artifacts.
 *
 * @example
 * ```ts
 * import { generateAndRunCode } from 'ai-functions'
 *
 * const { value } = await generateAndRunCode(
 *   { name: 'calculateTax', args: { amount: '(number)', rate: '(number)' } },
 *   { amount: 100, rate: 0.2 }
 * )
 * // value === 20  (the model authored the code, the sandbox ran it)
 * ```
 */
export async function generateAndRunCode<TOutput = unknown, TInput = unknown>(
  definition: CodeGenerationDefinition<TInput>,
  args?: TInput,
  env?: SandboxEnv
): Promise<GeneratedCodeRunResult<TOutput>> {
  const {
    name,
    description,
    language = 'typescript',
    instructions,
    returnType,
    includeTests = true,
    model = 'sonnet',
  } = definition

  const argsDescription = JSON.stringify(args ?? definition.args, null, 2)

  // Step 1 — model AUTHORS the module (+ optional tests). Non-deterministic.
  const codeSpec = `The complete ${language} module. It MUST contain a NAMED export 'export function ${name}(args) { ... }' (NOT a default export) that takes a single arguments object and returns the result. Output ONLY raw code, no markdown fences.`
  const schema: SimpleSchemaType = includeTests
    ? {
        code: codeSpec,
        tests: `vitest-style tests using global describe/it/expect. The function '${name}' is already in scope (do not import it). Output ONLY raw code, no markdown fences.`,
      }
    : {
        code: codeSpec,
      }

  const authored = await generateObject({
    model,
    schema,
    system: `You are an expert ${language} developer. Generate clean, production-ready code. The module MUST expose a NAMED export 'export function ${name}(args)' taking one arguments object — do NOT use 'export default'. Output ONLY raw code, no markdown code fences or language tags.`,
    prompt: `Author a ${language} module with the following specification:

Name: ${name}
Description: ${description || 'No description provided'}
Arguments: ${argsDescription}
Return Type: ${JSON.stringify(returnType)}

${instructions ? `Additional Instructions: ${instructions}` : ''}

Requirements:
- Expose 'export function ${name}(args) { ... }' (a NAMED export, not default), taking one arguments object.
- Handle edge cases appropriately.
- Return ONLY raw code without markdown formatting.`,
  })

  const authoredObj = authored.object as { code: string; tests?: string }
  const code = authoredObj.code
  const tests = includeTests ? authoredObj.tests : undefined

  // Step 2 — RUN the authored code in the sandbox and capture its return value.
  // The module's default export is invoked with the JSON-injected args; the
  // result is returned by the sandbox script. Tests (if any) run in the same
  // sandbox via the worker template's test runner.
  let argsJson: string
  try {
    argsJson = JSON.stringify(args ?? null)
  } catch (e) {
    throw new Error(
      `generateAndRunCode('${name}'): args are not JSON-serializable: ${(e as Error).message}`
    )
  }

  // The named export `${name}` is exposed as a top-level binding by the worker
  // template (`const { ${name} } = exports`). The script calls it with the
  // JSON-injected args and returns the result.
  const result = await runInSandbox(
    {
      module: code,
      script: `const __args__ = JSON.parse(${JSON.stringify(
        argsJson
      )}); if (typeof ${name} !== 'function') { throw new Error("authored module did not export a callable '${name}'"); } return await ${name}(__args__);`,
      ...(tests !== undefined && { tests }),
    },
    env
  )

  if (result.success === false) {
    throw new Error(
      `generateAndRunCode('${name}') failed in the sandbox: ${result.error ?? 'unknown error'}`
    )
  }

  return {
    value: result.value as TOutput,
    code,
    ...(tests !== undefined && { tests }),
    ...(result.testResults && {
      testResults: {
        total: result.testResults.total,
        passed: result.testResults.passed,
        failed: result.testResults.failed,
        skipped: result.testResults.skipped,
      },
    }),
    logs: result.logs.map((l) => ({ level: l.level, message: l.message })),
  }
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
  const call = async (args: TInput, env?: SandboxEnv): Promise<TOutput> => {
    switch (definition.type) {
      case 'code':
        // Optional host Workers env threads through to the sandbox for inline
        // `code` bodies; ignored for `handler` (direct call) and other types.
        return executeCodeFunction(definition, args, env) as Promise<TOutput>
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
