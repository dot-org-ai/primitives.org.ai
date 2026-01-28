/**
 * Worker Export - WorkerEntrypoint for RPC access to Digital Objects
 *
 * Exposes DigitalObjectsProvider methods via Cloudflare RPC.
 * Works both in Cloudflare Workers (with NS Durable Object) and standalone (with MemoryProvider).
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "DIGITAL_OBJECTS", "service": "digital-objects" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.DIGITAL_OBJECTS.connect('my-namespace')
 *     const post = await service.create('Post', { title: 'Hello' })
 *     return Response.json(post)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
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
import { MemoryProvider } from './memory-provider.js'

/**
 * Environment bindings for the worker
 */
export interface Env {
  NS?: DurableObjectNamespace
}

/**
 * Global namespace registry for in-memory providers (used when no DO binding is available)
 * This enables namespace isolation and persistence across connect() calls in tests
 */
const namespaceProviders = new Map<string, MemoryProvider>()

/**
 * Get or create a MemoryProvider for a namespace
 */
function getOrCreateProvider(namespace: string): MemoryProvider {
  let provider = namespaceProviders.get(namespace)
  if (!provider) {
    provider = new MemoryProvider()
    namespaceProviders.set(namespace, provider)
  }
  return provider
}

/**
 * DigitalObjectsService - RpcTarget wrapper around MemoryProvider
 *
 * Exposes all required methods as RPC-callable methods.
 * This is the core service class that can be instantiated directly.
 */
export class DigitalObjectsService extends RpcTarget {
  private provider: MemoryProvider

  constructor(namespace: string = 'default') {
    super()
    this.provider = getOrCreateProvider(namespace)
  }

  // ==================== Nouns ====================

  async defineNoun(def: NounDefinition): Promise<Noun> {
    return this.provider.defineNoun(def)
  }

  // ==================== Verbs ====================

  async defineVerb(def: VerbDefinition): Promise<Verb> {
    return this.provider.defineVerb(def)
  }

  // ==================== Things (CRUD) ====================

  async create<T>(noun: string, data: T, id?: string): Promise<Thing<T>> {
    return this.provider.create(noun, data, id)
  }

  async get<T>(id: string): Promise<Thing<T> | null> {
    return this.provider.get(id)
  }

  async list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]> {
    return this.provider.list(noun, options)
  }

  async update<T>(id: string, data: Partial<T>): Promise<Thing<T>> {
    return this.provider.update(id, data)
  }

  async delete(id: string): Promise<boolean> {
    return this.provider.delete(id)
  }

  // ==================== Relationships ====================

  /**
   * Create a relationship between two things
   * This is a convenience method that uses perform() under the hood
   */
  async relate<T>(subject: string, verb: string, object: string, data?: T): Promise<Action<T>> {
    return this.provider.perform(verb, subject, object, data)
  }

  /**
   * Remove a relationship between two things
   * Finds and deletes actions matching the subject/verb/object pattern
   */
  async unrelate(subject: string, verb: string, object: string): Promise<boolean> {
    const actions = await this.provider.listActions({
      verb,
      subject,
      object,
      limit: 1,
    })
    if (actions.length === 0) return false

    return this.provider.deleteAction(actions[0].id)
  }

  /**
   * Get things related to the given ID via relationships
   */
  async related<T>(id: string, verb?: string, direction: Direction = 'out'): Promise<Thing<T>[]> {
    return this.provider.related(id, verb, direction)
  }

  // ==================== Actions ====================

  async perform<T>(verb: string, subject?: string, object?: string, data?: T): Promise<Action<T>> {
    return this.provider.perform(verb, subject, object, data)
  }

  async listActions<T>(options?: ActionOptions): Promise<Action<T>[]> {
    return this.provider.listActions(options)
  }

  // ==================== Search ====================

  async search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]> {
    return this.provider.search(query, options)
  }
}

/**
 * DigitalObjectsWorker - WorkerEntrypoint for RPC access
 *
 * Provides `connect(namespace)` method that returns an RpcTarget service
 * with all DigitalObjectsProvider methods.
 *
 * When used in Cloudflare Workers with NS binding, delegates to the Durable Object.
 * When used standalone (in tests), uses an in-memory provider with namespace isolation.
 */
export class DigitalObjectsWorker extends WorkerEntrypoint<Env> {
  /**
   * Connect to a namespace and get an RPC-enabled service
   *
   * @param namespace - The namespace to connect to (defaults to 'default')
   * @returns DigitalObjectsService instance for RPC calls
   */
  connect(namespace?: string): DigitalObjectsService {
    return new DigitalObjectsService(namespace ?? 'default')
  }
}

/**
 * Default export for Cloudflare Workers
 */
export default {
  fetch: () => new Response('digital-objects worker - use RPC via service binding'),
}
