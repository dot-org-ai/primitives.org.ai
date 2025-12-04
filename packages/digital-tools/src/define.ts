/**
 * Tool Definition Utilities
 *
 * Provides helpers for defining tools with type safety
 * and automatic schema conversion.
 *
 * @packageDocumentation
 */

import type { JSONSchema } from 'ai-functions'
import type {
  AnyTool,
  Tool,
  ToolParameter,
  DefineToolOptions,
  ToolContext,
  ToolResult,
  Schema,
} from './types.js'
import { registry } from './registry.js'

/**
 * Check if a schema is a Zod schema
 */
function isZodSchema(schema: Schema): schema is { _def: unknown; parse: unknown } {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    '_def' in schema &&
    'parse' in schema
  )
}

/**
 * Convert a schema to JSON Schema format
 */
function toJSONSchema(schema: Schema): JSONSchema {
  if (isZodSchema(schema)) {
    // For Zod schemas, we'd use zod-to-json-schema in production
    // For now, return a basic representation
    return {
      type: 'object',
      description: 'Zod schema (convert with zod-to-json-schema)',
    }
  }
  return schema as JSONSchema
}

/**
 * Convert a schema definition to tool parameters
 */
function schemaToParameters(schema: Schema): ToolParameter[] {
  const jsonSchema = toJSONSchema(schema)

  if (jsonSchema.type !== 'object' || !jsonSchema.properties) {
    // Single parameter
    return [
      {
        name: 'input',
        description: jsonSchema.description || 'Input value',
        schema: jsonSchema,
        required: true,
      },
    ]
  }

  const required = jsonSchema.required || []

  return Object.entries(jsonSchema.properties).map(([name, propSchema]) => ({
    name,
    description:
      (propSchema as JSONSchema).description || `Parameter: ${name}`,
    schema: propSchema as JSONSchema,
    required: required.includes(name),
    default: (propSchema as JSONSchema).default,
  }))
}

/**
 * Define a new tool with type safety
 *
 * @example
 * ```ts
 * const sendEmail = defineTool({
 *   id: 'communication.email.send',
 *   name: 'Send Email',
 *   description: 'Send an email to one or more recipients',
 *   category: 'communication',
 *   subcategory: 'email',
 *   input: {
 *     type: 'object',
 *     properties: {
 *       to: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
 *       subject: { type: 'string', description: 'Email subject' },
 *       body: { type: 'string', description: 'Email body' },
 *     },
 *     required: ['to', 'subject', 'body'],
 *   },
 *   handler: async (input) => {
 *     // Send email logic
 *     return { success: true, messageId: 'msg_123' }
 *   },
 * })
 * ```
 */
export function defineTool<TInput, TOutput>(
  options: DefineToolOptions<TInput, TOutput>
): Tool<TInput, TOutput> {
  const tool: Tool<TInput, TOutput> = {
    id: options.id,
    name: options.name,
    description: options.description,
    category: options.category,
    subcategory: options.subcategory,
    parameters: schemaToParameters(options.input),
    output: options.output
      ? {
          description: 'Tool output',
          schema: options.output,
        }
      : undefined,
    handler: options.handler,
    ...options.options,
  }

  return tool
}

/**
 * Define and register a tool in one step
 */
export function defineAndRegister<TInput, TOutput>(
  options: DefineToolOptions<TInput, TOutput>
): Tool<TInput, TOutput> {
  const tool = defineTool(options)
  registry.register(tool)
  return tool
}

/**
 * Create a tool executor with context
 *
 * @example
 * ```ts
 * const executor = createToolExecutor({
 *   executor: { type: 'agent', id: 'agent_123', name: 'Research Agent' },
 *   environment: 'production',
 * })
 *
 * const result = await executor.execute('communication.email.send', {
 *   to: ['user@example.com'],
 *   subject: 'Hello',
 *   body: 'World',
 * })
 * ```
 */
export function createToolExecutor(context: ToolContext) {
  return {
    /**
     * Execute a tool by ID with context tracking
     */
    async execute<TInput, TOutput>(
      toolId: string,
      input: TInput
    ): Promise<ToolResult<TOutput>> {
      const tool = registry.get(toolId)

      if (!tool) {
        return {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `Tool "${toolId}" not found`,
          },
        }
      }

      // Check audience restrictions
      if (
        tool.audience &&
        tool.audience !== 'both' &&
        tool.audience !== context.executor.type
      ) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: `Tool "${toolId}" is not available for ${context.executor.type}`,
          },
        }
      }

      const startTime = Date.now()

      try {
        const data = (await tool.handler(input)) as TOutput
        const duration = Date.now() - startTime

        return {
          success: true,
          data,
          metadata: {
            duration,
            requestId: context.requestId,
          },
        }
      } catch (error) {
        const duration = Date.now() - startTime

        return {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error),
            details: error,
          },
          metadata: {
            duration,
            requestId: context.requestId,
          },
        }
      }
    },

    /**
     * List available tools for this executor
     */
    listAvailable(): AnyTool[] {
      return registry.query({
        audience: context.executor.type,
      })
    },
  }
}

/**
 * Tool builder for fluent API
 *
 * @example
 * ```ts
 * const tool = toolBuilder('web.fetch')
 *   .name('Fetch URL')
 *   .description('Fetch content from a URL')
 *   .category('web')
 *   .subcategory('fetch')
 *   .input({
 *     type: 'object',
 *     properties: {
 *       url: { type: 'string', description: 'URL to fetch' },
 *     },
 *     required: ['url'],
 *   })
 *   .handler(async ({ url }) => {
 *     const response = await fetch(url)
 *     return response.text()
 *   })
 *   .build()
 * ```
 */
export function toolBuilder(id: string) {
  const config: Partial<DefineToolOptions<unknown, unknown>> = { id }

  return {
    name(name: string) {
      config.name = name
      return this
    },

    description(description: string) {
      config.description = description
      return this
    },

    category(category: DefineToolOptions<unknown, unknown>['category']) {
      config.category = category
      return this
    },

    subcategory(subcategory: DefineToolOptions<unknown, unknown>['subcategory']) {
      config.subcategory = subcategory
      return this
    },

    input(schema: Schema) {
      config.input = schema
      return this
    },

    output(schema: Schema) {
      config.output = schema
      return this
    },

    handler<TInput, TOutput>(fn: (input: TInput) => TOutput | Promise<TOutput>) {
      config.handler = fn as (input: unknown) => unknown | Promise<unknown>
      return this as unknown as {
        build(): Tool<TInput, TOutput>
        register(): Tool<TInput, TOutput>
        options(opts: Partial<AnyTool>): ReturnType<typeof toolBuilder>
      }
    },

    options(opts: Partial<AnyTool>) {
      config.options = opts as DefineToolOptions<unknown, unknown>['options']
      return this
    },

    build<TInput, TOutput>(): Tool<TInput, TOutput> {
      if (!config.name || !config.description || !config.category || !config.input || !config.handler) {
        throw new Error('Tool requires id, name, description, category, input, and handler')
      }
      return defineTool(config as DefineToolOptions<TInput, TOutput>)
    },

    register<TInput, TOutput>(): Tool<TInput, TOutput> {
      const tool = this.build<TInput, TOutput>()
      registry.register(tool)
      return tool
    },
  }
}
