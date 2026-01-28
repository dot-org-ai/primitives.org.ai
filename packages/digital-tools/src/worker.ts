/**
 * Tool Worker - provides tool service via RPC
 *
 * This worker can be deployed to Cloudflare Workers or run locally via Miniflare.
 * It exposes tool registration, discovery, execution, and MCP conversion via Workers RPC.
 *
 * Uses Cloudflare Workers RPC (WorkerEntrypoint, RpcTarget) for communication.
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
import type { AnyTool, ToolCategory, ToolQuery, MCPTool, ToolSubcategory } from './types.js'

/**
 * Core tool service - extends RpcTarget so it can be passed over RPC
 *
 * Contains all tool functionality: registration, discovery, execution, and MCP conversion
 */
export class ToolServiceCore extends RpcTarget {
  private tools: Map<string, AnyTool> = new Map()

  constructor() {
    super()
    // Register built-in tools
    this.registerBuiltins()
  }

  /**
   * Register built-in tools
   */
  private registerBuiltins(): void {
    // data.json.parse
    this.register({
      id: 'data.json.parse',
      name: 'Parse JSON',
      description: 'Parse a JSON string into an object',
      category: 'data',
      subcategory: 'transform',
      parameters: [
        {
          name: 'text',
          description: 'JSON string to parse',
          schema: { type: 'string' },
          required: true,
        },
      ],
      handler: async (input: { text: string }) => {
        try {
          const data = JSON.parse(input.text)
          return { data, valid: true }
        } catch (e) {
          return {
            data: null,
            valid: false,
            error: e instanceof Error ? e.message : 'Invalid JSON',
          }
        }
      },
      tags: ['json', 'parse', 'transform'],
    })

    // data.csv.parse
    this.register({
      id: 'data.csv.parse',
      name: 'Parse CSV',
      description: 'Parse CSV text into an array of objects',
      category: 'data',
      subcategory: 'transform',
      parameters: [
        {
          name: 'text',
          description: 'CSV text to parse',
          schema: { type: 'string' },
          required: true,
        },
        {
          name: 'delimiter',
          description: 'Column delimiter (default: comma)',
          schema: { type: 'string' },
          required: false,
        },
        {
          name: 'hasHeaders',
          description: 'First row is headers (default: true)',
          schema: { type: 'boolean' },
          required: false,
        },
      ],
      handler: async (input: { text: string; delimiter?: string; hasHeaders?: boolean }) => {
        const delimiter = input.delimiter || ','
        const hasHeaders = input.hasHeaders !== false
        const lines = input.text.split('\n').filter((line) => line.trim())

        if (lines.length === 0) {
          return { rows: [], headers: [], rowCount: 0 }
        }

        const firstLine = lines[0]!
        const headers = hasHeaders
          ? firstLine.split(delimiter).map((h) => h.trim())
          : firstLine.split(delimiter).map((_, i) => `column${i + 1}`)

        const dataLines = hasHeaders ? lines.slice(1) : lines

        const rows = dataLines.map((line) => {
          const values = line.split(delimiter).map((v) => v.trim())
          const row: Record<string, string> = {}
          headers.forEach((header, i) => {
            row[header] = values[i] || ''
          })
          return row
        })

        return { rows, headers, rowCount: rows.length }
      },
      tags: ['csv', 'parse', 'transform'],
    })

    // data.transform
    this.register({
      id: 'data.transform',
      name: 'Transform Data',
      description: 'Transform data by mapping fields to new structure',
      category: 'data',
      subcategory: 'transform',
      parameters: [
        {
          name: 'data',
          description: 'Source data to transform',
          schema: {},
          required: true,
        },
        {
          name: 'transform',
          description: 'Mapping of output fields to input paths',
          schema: { type: 'object' },
          required: true,
        },
      ],
      handler: async (input: { data: unknown; transform: Record<string, string> }) => {
        const result: Record<string, unknown> = {}

        for (const [outputKey, inputPath] of Object.entries(input.transform)) {
          const pathParts = inputPath.split('.')
          let value: unknown = input.data

          for (const part of pathParts) {
            if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
              value = (value as Record<string, unknown>)[part]
            } else {
              value = undefined
              break
            }
          }

          result[outputKey] = value
        }

        return { result }
      },
      tags: ['transform', 'map', 'extract'],
    })
  }

  /**
   * Register a tool in the service registry
   */
  register(tool: AnyTool): void {
    this.tools.set(tool.id, tool)
  }

  /**
   * Unregister a tool
   */
  unregister(id: string): boolean {
    return this.tools.delete(id)
  }

  /**
   * Get a tool by ID
   */
  get(id: string): AnyTool | undefined {
    return this.tools.get(id)
  }

  /**
   * Check if a tool exists
   */
  has(id: string): boolean {
    return this.tools.has(id)
  }

  /**
   * List all tool IDs
   */
  list(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Query tools with filtering
   */
  query(options: ToolQuery): AnyTool[] {
    let results = Array.from(this.tools.values())

    // Filter by category
    if (options.category) {
      results = results.filter((t) => t.category === options.category)
    }

    // Filter by subcategory
    if (options.subcategory) {
      results = results.filter((t) => t.subcategory === options.subcategory)
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((t) => t.tags && options.tags!.some((tag) => t.tags!.includes(tag)))
    }

    // Filter by audience
    if (options.audience) {
      results = results.filter(
        (t) => t.audience === options.audience || t.audience === 'both' || !t.audience
      )
    }

    // Text search
    if (options.search) {
      const search = options.search.toLowerCase()
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.id.toLowerCase().includes(search)
      )
    }

    // Pagination
    const offset = options.offset ?? 0
    const limit = options.limit ?? results.length
    results = results.slice(offset, offset + limit)

    return results
  }

  /**
   * Get tools by category
   */
  byCategory(category: ToolCategory): AnyTool[] {
    return this.query({ category })
  }

  /**
   * Execute a tool by ID
   */
  async executeTool<TInput = unknown, TOutput = unknown>(
    id: string,
    input: TInput
  ): Promise<TOutput> {
    const tool = this.tools.get(id)
    if (!tool) {
      throw new Error(`Tool "${id}" not found`)
    }
    return tool.handler(input) as Promise<TOutput>
  }

  /**
   * Convert a Tool to MCP format
   */
  toMCP(tool: AnyTool): MCPTool {
    return {
      name: tool.id,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            typeof p.schema === 'object' && 'type' in p.schema
              ? { ...p.schema, description: p.description }
              : { description: p.description },
          ])
        ),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }
  }

  /**
   * Convert all registered tools to MCP format
   */
  listMCPTools(): MCPTool[] {
    return this.list().map((id) => this.toMCP(this.get(id)!))
  }

  /**
   * Import a tool from MCP format
   */
  fromMCP(
    mcpTool: MCPTool,
    handler: (input: unknown) => unknown | Promise<unknown>,
    options?: {
      category?: ToolCategory
      subcategory?: ToolSubcategory
      tags?: string[]
    }
  ): AnyTool {
    const inputSchema = mcpTool.inputSchema
    const properties = inputSchema.properties || {}
    const required = inputSchema.required || []

    const parameters = Object.entries(properties).map(([name, schema]) => ({
      name,
      description: (schema as { description?: string }).description || `Parameter: ${name}`,
      schema: schema as { type?: string },
      required: required.includes(name),
    }))

    const tool: AnyTool = {
      id: mcpTool.name,
      name: mcpTool.name,
      description: mcpTool.description,
      category: options?.category || 'integration',
      ...(options?.subcategory !== undefined && { subcategory: options.subcategory }),
      ...(options?.tags !== undefined && { tags: options.tags }),
      parameters,
      handler,
    }

    return tool
  }

  /**
   * Clear all tools (except built-ins if keepBuiltins is true)
   */
  clear(keepBuiltins: boolean = false): void {
    if (keepBuiltins) {
      const builtinIds = ['data.json.parse', 'data.csv.parse', 'data.transform']
      const builtins = builtinIds.map((id) => this.tools.get(id)).filter(Boolean) as AnyTool[]
      this.tools.clear()
      builtins.forEach((tool) => this.tools.set(tool.id, tool))
    } else {
      this.tools.clear()
    }
  }
}

/**
 * Main tool service exposed via RPC as WorkerEntrypoint
 *
 * Usage:
 *   const tools = await env.TOOLS.connect()
 *   tools.register({ id: 'my.tool', ... })
 *   tools.list()
 *   const result = await tools.executeTool('data.json.parse', { text: '{}' })
 */
export class ToolService extends WorkerEntrypoint {
  /**
   * Get a tool service instance - returns an RpcTarget that can be used directly
   */
  connect(): ToolServiceCore {
    return new ToolServiceCore()
  }
}

// Export as default for WorkerEntrypoint pattern
export default ToolService

// Export aliases
export { ToolService as ToolWorker }
