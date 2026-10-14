/**
 * rpc.do transport adapter for Digital Objects
 *
 * Default implementation of the {@link DigitalObjectsTransport} port,
 * backed by rpc.do's HTTP transport. This is the only module in the
 * package that imports the rpc.do SDK — the core client
 * (`digital-objects/client`) depends solely on the port interface.
 *
 * @example
 * ```ts
 * import client from 'digital-objects/transports/rpc'
 *
 * const post = await client.create('Post', { title: 'Hello World' })
 * const found = await client.get(post.id)
 * ```
 *
 * @packageDocumentation
 */

import {
  RPC,
  http,
  type RPCProxy,
  type SqlQuery,
  type RemoteStorage,
  type RemoteCollections,
  type DatabaseSchema,
  type RpcSchema,
} from 'rpc.do'
import {
  createDigitalObjectsClient,
  DEFAULT_DIGITAL_OBJECTS_URL,
  type DigitalObjectsAPI,
  type DigitalObjectsClientOptions,
  type DigitalObjectsClientProxy,
  type DigitalObjectsTransport,
} from '../client.js'

/**
 * DO Client features available on RPC proxy
 * This mirrors the DOClientFeatures interface from rpc.do which is not exported
 */
interface DOClientFeatures {
  /** Tagged template SQL query */
  sql: <R = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => SqlQuery<R>
  /** Remote storage access */
  storage: RemoteStorage
  /** Remote collection access (MongoDB-style) */
  collection: RemoteCollections
  /** Get database schema */
  dbSchema: () => Promise<DatabaseSchema>
  /** Get full RPC schema */
  schema: () => Promise<RpcSchema>
}

/**
 * Type for the Digital Objects RPC client
 */
export type DigitalObjectsClient = RPCProxy<DigitalObjectsAPI> & DOClientFeatures

/**
 * rpc.do-backed implementation of the {@link DigitalObjectsTransport} port
 */
export const rpcTransport: DigitalObjectsTransport = {
  connect<API extends object>(
    url: string,
    options?: DigitalObjectsClientOptions
  ): DigitalObjectsClientProxy<API> {
    return RPC<API>(http(url, options?.token)) as DigitalObjectsClientProxy<API>
  },
}

/**
 * Create a typed RPC client for the digital-objects worker over rpc.do
 *
 * Convenience wrapper binding {@link rpcTransport} into
 * {@link createDigitalObjectsClient}.
 *
 * @param url - The URL of the deployed digital-objects worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all DigitalObjectsService methods
 *
 * @example
 * ```ts
 * import { createRpcDigitalObjectsClient } from 'digital-objects/transports/rpc'
 *
 * const client = createRpcDigitalObjectsClient('https://digital-objects.workers.dev')
 * const post = await client.create('Post', { title: 'Hello', body: 'World' })
 * ```
 */
export function createRpcDigitalObjectsClient(
  url: string = DEFAULT_DIGITAL_OBJECTS_URL,
  options?: DigitalObjectsClientOptions
): DigitalObjectsClient {
  return createDigitalObjectsClient(rpcTransport, url, options) as DigitalObjectsClient
}

/**
 * Default client instance connected to the production digital-objects worker
 *
 * @example
 * ```ts
 * import client from 'digital-objects/transports/rpc'
 *
 * const post = await client.create('Post', { title: 'Hello' })
 * ```
 */
const client: DigitalObjectsClient = createRpcDigitalObjectsClient()

export default client
