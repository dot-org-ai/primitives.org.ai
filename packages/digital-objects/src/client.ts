/**
 * RPC Client for Digital Objects
 *
 * Provides a typed RPC client that connects to the deployed
 * digital-objects worker using rpc.do for remote procedure calls.
 *
 * @example
 * ```ts
 * import { createDigitalObjectsClient } from 'digital-objects/client'
 *
 * const client = createDigitalObjectsClient('https://digital-objects.workers.dev')
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

import type {
  Noun,
  NounDefinition,
  Verb,
  VerbDefinition,
  Thing,
  Action,
  ListOptions,
  ActionOptions,
  Direction,
} from './types.js'

// ==================== API Type ====================

/**
 * DigitalObjectsAPI - Type-safe interface matching DigitalObjectsService RPC methods
 *
 * This interface mirrors all public methods on DigitalObjectsService so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface DigitalObjectsAPI {
  // Nouns
  defineNoun(def: NounDefinition): Promise<Noun>

  // Verbs
  defineVerb(def: VerbDefinition): Promise<Verb>

  // Things (CRUD)
  create<T>(noun: string, data: T, id?: string): Promise<Thing<T>>
  get<T>(id: string): Promise<Thing<T> | null>
  list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]>
  update<T>(id: string, data: Partial<T>): Promise<Thing<T>>
  delete(id: string): Promise<boolean>

  // Relationships
  relate<T>(subject: string, verb: string, object: string, data?: T): Promise<Action<T>>
  unrelate(subject: string, verb: string, object: string): Promise<boolean>
  related<T>(id: string, verb?: string, direction?: Direction): Promise<Thing<T>[]>

  // Actions
  perform<T>(verb: string, subject?: string, object?: string, data?: T): Promise<Action<T>>
  listActions<T>(options?: ActionOptions): Promise<Action<T>[]>

  // Search
  search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]>
}

// ==================== Client Options ====================

/**
 * Options for creating a digital objects RPC client
 */
export interface DigitalObjectsClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the digital-objects worker */
const DEFAULT_URL = 'https://digital-objects.workers.dev'

/**
 * Create a typed RPC client for the digital-objects worker
 *
 * @param url - The URL of the deployed digital-objects worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all DigitalObjectsService methods
 *
 * @example
 * ```ts
 * import { createDigitalObjectsClient } from 'digital-objects/client'
 *
 * // Connect to production
 * const client = createDigitalObjectsClient('https://digital-objects.workers.dev')
 *
 * // Define entity types
 * await client.defineNoun({ name: 'Post', description: 'A blog post' })
 * await client.defineVerb({ name: 'publish' })
 *
 * // Create and manage things
 * const post = await client.create('Post', { title: 'Hello', body: 'World' })
 * const posts = await client.list('Post', { limit: 10 })
 *
 * // Perform actions and create relationships
 * await client.perform('publish', authorId, post.id)
 * const related = await client.related(authorId, 'publish', 'out')
 * ```
 */
export function createDigitalObjectsClient(
  url: string = DEFAULT_URL,
  options?: DigitalObjectsClientOptions
): DigitalObjectsClient {
  return RPC<DigitalObjectsAPI>(http(url, options?.token))
}

/**
 * Default client instance connected to the production digital-objects worker
 *
 * @example
 * ```ts
 * import client from 'digital-objects/client'
 *
 * const post = await client.create('Post', { title: 'Hello' })
 * ```
 */
const client: DigitalObjectsClient = createDigitalObjectsClient()

export default client
