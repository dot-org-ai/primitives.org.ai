/**
 * rpc.do transport adapter for digital-tools
 *
 * Default implementation of the {@link ToolTransport} port, backed by
 * rpc.do's HTTP transport. This is the only module in the package that
 * imports the rpc.do SDK — the core client (`digital-tools/client`)
 * depends solely on the port interface.
 *
 * @example
 * ```ts
 * import client from 'digital-tools/transports/rpc'
 *
 * const tools = await client.list()
 * const result = await client.executeTool('data.json.parse', { text: '{}' })
 * ```
 *
 * @packageDocumentation
 */

import { RPC, http } from 'rpc.do'
import {
  createToolClient,
  DEFAULT_TOOL_WORKER_URL,
  type ToolClientOptions,
  type ToolClientProxy,
  type ToolServiceAPI,
  type ToolTransport,
} from '../client.js'

/**
 * rpc.do-backed implementation of the {@link ToolTransport} port
 */
export const rpcTransport: ToolTransport = {
  connect<API extends object>(url: string, options?: ToolClientOptions): ToolClientProxy<API> {
    return RPC<API>(http(url, options?.token)) as ToolClientProxy<API>
  },
}

/**
 * Create an RPC client connected to a digital-tools worker over rpc.do
 *
 * Convenience wrapper binding {@link rpcTransport} into
 * {@link createToolClient}.
 *
 * @param url - The URL of the deployed digital-tools worker
 * @param options - Optional client configuration
 * @returns A typed RPC client for the tool service
 *
 * @example
 * ```ts
 * import { createRpcToolClient } from 'digital-tools/transports/rpc'
 *
 * const client = createRpcToolClient('https://my-tools.example.com')
 * const toolIds = await client.list()
 * ```
 */
export function createRpcToolClient(
  url: string = DEFAULT_TOOL_WORKER_URL,
  options?: ToolClientOptions
): ToolClientProxy<ToolServiceAPI> {
  return createToolClient(rpcTransport, url, options)
}

/**
 * Default RPC client connected to the standard digital-tools worker deployment
 *
 * @example
 * ```ts
 * import client from 'digital-tools/transports/rpc'
 *
 * const tools = await client.list()
 * const result = await client.executeTool('data.json.parse', { text: '{}' })
 * ```
 */
const client = createRpcToolClient()

export default client
