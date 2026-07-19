/**
 * RPC Client for digital-tools worker
 *
 * Connects to a deployed digital-tools worker through an injected
 * {@link ToolTransport}, providing a fully typed client for tool
 * discovery, execution, and MCP conversion.
 *
 * This module only knows the transport port — no SDK imports here.
 * The default rpc.do-backed adapter lives at
 * `digital-tools/transports/rpc` (same injected-port discipline as
 * ADR-0004's `DurableExecutionAdapter`): consumer code imports
 * interfaces; the concrete binding is wired at the edge.
 *
 * @example
 * ```ts
 * import { createToolClient } from 'digital-tools/client'
 * import { rpcTransport } from 'digital-tools/transports/rpc'
 *
 * const client = createToolClient(rpcTransport, 'https://digital-tools.workers.dev')
 * const tools = await client.list()
 * const result = await client.executeTool('data.json.parse', { text: '{}' })
 * ```
 *
 * @packageDocumentation
 */

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
 * Remote proxy over an API surface — every method becomes async
 *
 * Mirrors the shape a transport's proxy produces without depending on
 * any concrete transport's types.
 */
export type ToolClientProxy<API> = {
  [K in keyof API]: API[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : API[K]
}

/**
 * Transport port for connecting to a digital-tools worker
 *
 * Implementations turn a worker URL (plus optional auth) into a typed
 * remote proxy for the given API surface. The default rpc.do-backed
 * implementation is exported from `digital-tools/transports/rpc`.
 */
export interface ToolTransport {
  /** Connect to a worker at the given URL, returning a typed remote proxy */
  connect<API extends object>(url: string, options?: ToolClientOptions): ToolClientProxy<API>
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
export const DEFAULT_TOOL_WORKER_URL = 'https://digital-tools.workers.dev'

/**
 * Create a client that connects to a deployed digital-tools worker
 * over an injected transport
 *
 * @param transport - The transport to connect through (e.g. the
 *   rpc.do-backed adapter from `digital-tools/transports/rpc`)
 * @param url - The URL of the deployed digital-tools worker
 * @param options - Optional client configuration
 * @returns A typed client for the tool service
 *
 * @example
 * ```ts
 * import { createToolClient } from 'digital-tools/client'
 * import { rpcTransport } from 'digital-tools/transports/rpc'
 *
 * // Connect to default worker
 * const client = createToolClient(rpcTransport)
 *
 * // Connect to custom deployment
 * const client = createToolClient(rpcTransport, 'https://my-tools.example.com')
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
export function createToolClient(
  transport: ToolTransport,
  url: string = DEFAULT_TOOL_WORKER_URL,
  options?: ToolClientOptions
): ToolClientProxy<ToolServiceAPI> {
  return transport.connect<ToolServiceAPI>(url, options)
}
