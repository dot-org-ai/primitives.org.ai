/**
 * RPC Client for Digital Objects
 *
 * Provides a typed client that connects to a deployed digital-objects
 * worker through an injected {@link DigitalObjectsTransport}.
 *
 * This module only knows the transport port — no SDK imports here.
 * The default rpc.do-backed adapter lives at
 * `digital-objects/transports/rpc` (same injected-port discipline as
 * ADR-0004's `DurableExecutionAdapter`): consumer code imports
 * interfaces; the concrete binding is wired at the edge.
 *
 * @example
 * ```ts
 * import { createDigitalObjectsClient } from 'digital-objects/client'
 * import { rpcTransport } from 'digital-objects/transports/rpc'
 *
 * const client = createDigitalObjectsClient(rpcTransport, 'https://digital-objects.workers.dev')
 * const post = await client.create('Post', { title: 'Hello World' })
 * const found = await client.get(post.id)
 * ```
 *
 * @packageDocumentation
 */

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

// ==================== Transport Port ====================

/**
 * Remote proxy over an API surface — every method becomes async
 *
 * Mirrors the shape a transport's proxy produces without depending on
 * any concrete transport's types.
 */
export type DigitalObjectsClientProxy<API> = {
  [K in keyof API]: API[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : API[K]
}

/**
 * Transport port for connecting to a digital-objects worker
 *
 * Implementations turn a worker URL (plus optional auth) into a typed
 * remote proxy for the given API surface. The default rpc.do-backed
 * implementation is exported from `digital-objects/transports/rpc`.
 */
export interface DigitalObjectsTransport {
  /** Connect to a worker at the given URL, returning a typed remote proxy */
  connect<API extends object>(
    url: string,
    options?: DigitalObjectsClientOptions
  ): DigitalObjectsClientProxy<API>
}

// ==================== Client Factory ====================

/** Default URL for the digital-objects worker */
export const DEFAULT_DIGITAL_OBJECTS_URL = 'https://digital-objects.workers.dev'

/**
 * Create a typed client for the digital-objects worker over an
 * injected transport
 *
 * @param transport - The transport to connect through (e.g. the
 *   rpc.do-backed adapter from `digital-objects/transports/rpc`)
 * @param url - The URL of the deployed digital-objects worker
 * @param options - Optional client configuration
 * @returns A typed client with all DigitalObjectsService methods
 *
 * @example
 * ```ts
 * import { createDigitalObjectsClient } from 'digital-objects/client'
 * import { rpcTransport } from 'digital-objects/transports/rpc'
 *
 * // Connect to production
 * const client = createDigitalObjectsClient(rpcTransport, 'https://digital-objects.workers.dev')
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
  transport: DigitalObjectsTransport,
  url: string = DEFAULT_DIGITAL_OBJECTS_URL,
  options?: DigitalObjectsClientOptions
): DigitalObjectsClientProxy<DigitalObjectsAPI> {
  return transport.connect<DigitalObjectsAPI>(url, options)
}
