/**
 * RPC Client for digital-tools worker
 *
 * Connects to a deployed digital-tools worker using rpc.do,
 * providing a fully typed client for tool discovery, execution,
 * and MCP conversion.
 *
 * @example
 * ```ts
 * import { createToolClient } from 'digital-tools/client'
 *
 * const client = createToolClient('https://digital-tools.workers.dev')
 * const tools = await client.list()
 * const result = await client.executeTool('data.json.parse', { text: '{}' })
 * ```
 *
 * @packageDocumentation
 */

import { RPC } from 'rpc.do'
import type { AnyTool, ToolCategory, ToolQuery, MCPTool, ToolSubcategory } from './types.js'

/**
 * Client options for connecting to a digital-tools worker
 */
export interface ToolClientOptions {
  /** Authentication token */
  token?: string
  /** Custom headers */
  headers?: Record<string, string>
}

/**
 * API type matching ToolServiceCore's public RPC methods
 *
 * This interface mirrors the public methods of ToolServiceCore
 * from the worker, providing a typed contract for the RPC client.
 */
export interface ToolServiceAPI {
  /** Register a tool in the service registry */
  register(tool: AnyTool): void

  /** Unregister a tool */
  unregister(id: string): boolean

  /** Get a tool by ID */
  get(id: string): AnyTool | undefined

  /** Check if a tool exists */
  has(id: string): boolean

  /** List all tool IDs */
  list(): string[]

  /** Query tools with filtering */
  query(options: ToolQuery): AnyTool[]

  /** Get tools by category */
  byCategory(category: ToolCategory): AnyTool[]

  /** Execute a tool by ID */
  executeTool<TInput = unknown, TOutput = unknown>(id: string, input: TInput): Promise<TOutput>

  /** Convert a tool to MCP format */
  toMCP(tool: AnyTool): MCPTool

  /** Convert all registered tools to MCP format */
  listMCPTools(): MCPTool[]

  /** Import a tool from MCP format */
  fromMCP(
    mcpTool: MCPTool,
    handler: (input: unknown) => unknown | Promise<unknown>,
    options?: {
      category?: ToolCategory
      subcategory?: ToolSubcategory
      tags?: string[]
    }
  ): AnyTool

  /** Clear all tools */
  clear(keepBuiltins?: boolean): void
}

/** Default worker URL for digital-tools */
const DEFAULT_URL = 'https://digital-tools.workers.dev'

/**
 * Create an RPC client that connects to a deployed digital-tools worker
 *
 * @param url - The URL of the deployed digital-tools worker
 * @param options - Optional client configuration
 * @returns A typed RPC client for the tool service
 *
 * @example
 * ```ts
 * import { createToolClient } from 'digital-tools/client'
 *
 * // Connect to default worker
 * const client = createToolClient()
 *
 * // Connect to custom deployment
 * const client = createToolClient('https://my-tools.example.com')
 *
 * // List available tools
 * const toolIds = await client.list()
 *
 * // Execute a tool
 * const result = await client.executeTool('data.json.parse', { text: '{"key": "value"}' })
 *
 * // Query tools by category
 * const dataTools = await client.query({ category: 'data' })
 *
 * // Get MCP-compatible tool definitions
 * const mcpTools = await client.listMCPTools()
 * ```
 */
export function createToolClient(url: string = DEFAULT_URL, options?: ToolClientOptions) {
  return RPC<ToolServiceAPI>(url, options)
}

/**
 * Default RPC client connected to the standard digital-tools worker deployment
 *
 * @example
 * ```ts
 * import client from 'digital-tools/client'
 *
 * const tools = await client.list()
 * const result = await client.executeTool('data.json.parse', { text: '{}' })
 * ```
 */
const client = createToolClient()

export default client
