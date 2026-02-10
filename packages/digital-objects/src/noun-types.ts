/**
 * Core types for the Noun() factory system
 *
 * Noun() is the high-level entity definition API for headless.ly.
 * It produces typed, event-sourced entities with CRUD + custom verbs.
 */

/**
 * Property value in a Noun definition:
 * - string pattern: field type, relationship, enum, or verb declaration
 * - null: disable a CRUD verb
 */
export type PropertyValue = string | null

/**
 * The input definition object passed to Noun()
 */
export type NounDefinitionInput = Record<string, PropertyValue>

/**
 * Field modifier flags parsed from type strings
 * e.g., 'string!#' → { required: true, optional: false, indexed: true, unique: false, array: false }
 */
export interface FieldModifiers {
  required: boolean
  optional: boolean
  indexed: boolean
  unique: boolean
  array: boolean
}

/**
 * The kind of property parsed from the definition
 */
export type PropertyKind = 'field' | 'relationship' | 'enum' | 'verb' | 'disabled'

/**
 * Parsed property result
 */
export interface ParsedProperty {
  name: string
  kind: PropertyKind
  type?: string | undefined
  modifiers?: FieldModifiers | undefined
  defaultValue?: string | undefined
  enumValues?: string[] | undefined
  operator?: string | undefined
  targetType?: string | undefined
  backref?: string | undefined
  isArray?: boolean | undefined
  verbAction?: string | undefined
  verbConjugation?: VerbConjugation | undefined
}

/**
 * Full verb conjugation
 *
 * qualify() → qualifying() → qualified()
 * action     activity        event
 */
export interface VerbConjugation {
  action: string
  activity: string
  event: string
  reverseBy: string
  reverseAt: string
}

/**
 * Complete noun schema after parsing
 */
export interface NounSchema {
  name: string
  singular: string
  plural: string
  slug: string
  fields: Map<string, ParsedProperty>
  relationships: Map<string, ParsedProperty>
  verbs: Map<string, VerbConjugation>
  disabledVerbs: Set<string>
  raw: NounDefinitionInput
}

/**
 * Instance returned from CRUD operations
 *
 * Every entity carries base meta-fields: $type, $id, $context, $version, $createdAt, $updatedAt
 */
export interface NounInstance {
  $id: string
  $type: string
  $context: string
  $version: number
  $createdAt: string
  $updatedAt: string
  [key: string]: unknown
}

/**
 * BEFORE hook handler — called before a verb executes
 * Return a modified data object to transform the input, or void to pass through.
 * Throw to reject the operation.
 */
export type BeforeHookHandler = (
  data: Record<string, unknown>,
) => void | Record<string, unknown> | Promise<void> | Promise<Record<string, unknown>>

/**
 * AFTER hook handler — called after a verb executes
 * Receives the resulting instance and optional cross-domain context ($).
 */
export type AfterHookHandler = (
  instance: NounInstance,
  $?: Record<string, unknown>,
) => void | Promise<void>

/**
 * The typed interface returned by Noun()
 *
 * Provides typed CRUD methods, hook registration, schema access,
 * and custom verb dispatch via index signature.
 */
export interface NounEntity {
  /** Create a new entity instance */
  create(data: Record<string, unknown>): Promise<NounInstance>
  /** Get an entity by ID */
  get(id: string): Promise<NounInstance | null>
  /** Find entities matching a filter */
  find(where?: Record<string, unknown>): Promise<NounInstance[]>
  /** Find the first entity matching a filter, or null */
  findOne(where?: Record<string, unknown>): Promise<NounInstance | null>
  /** Update an entity by ID */
  update(id: string, data: Record<string, unknown>): Promise<NounInstance>
  /** Delete an entity by ID */
  delete(id: string): Promise<boolean>
  /** Rollback an entity to a previous version (creates a new version with the old state) */
  rollback(id: string, toVersion: number): Promise<NounInstance>
  /** Watch an entity for changes, returns unsubscribe function */
  watch(id: string, callback: (instance: NounInstance) => void): () => void
  /** Access the noun schema */
  $schema: NounSchema
  /** Access the noun name */
  $name: string
  /** Custom verbs, hook registration, and dynamic access */
  [key: string]: unknown
}

/**
 * Provider interface for Noun runtime storage
 *
 * The Noun proxy dispatches all operations to a NounProvider.
 * Default: MemoryNounProvider (in-process Map).
 */
export interface NounProvider {
  create(type: string, data: Record<string, unknown>): Promise<NounInstance>
  get(type: string, id: string): Promise<NounInstance | null>
  find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]>
  findOne(type: string, where?: Record<string, unknown>): Promise<NounInstance | null>
  update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance>
  delete(type: string, id: string): Promise<boolean>
  perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance>
  rollback(type: string, id: string, toVersion: number): Promise<NounInstance>
}

/**
 * Entity event recorded for every mutation
 */
export interface EntityEvent {
  type: string
  action: 'created' | 'updated' | 'deleted' | 'performed'
  verb?: string
  entityId: string
  data: NounInstance | null
  previousData: NounInstance | null
  timestamp: string
  version: number
}

/**
 * A promise that supports pipelining — property access and chaining
 * before resolution, inspired by Cap'n Proto / capnweb.
 *
 * Extends PromiseLike<T> so it works anywhere a Promise does (await, .then),
 * but also supports .pipe() for explicit pipelined transforms that preserve
 * the RpcPromise wrapper and avoid forcing resolution.
 */
export interface RpcPromise<T> extends PromiseLike<T> {
  /**
   * Chain a transform without forcing resolution.
   * The transform runs when the promise settles, but the return type
   * remains an RpcPromise so further pipelining is possible.
   */
  pipe<U>(fn: (value: T) => U | PromiseLike<U>): RpcPromise<U>

  /**
   * Standard Promise interop — allows await and .then() chains
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

/**
 * A NounProvider that supports promise pipelining
 *
 * Methods return RpcPromise<T> instead of Promise<T>, allowing the Noun
 * proxy to pass through pipelineable results without forcing resolution.
 * This enables single-round-trip chains via capnweb / rpc.do.
 *
 * The Noun proxy detects this interface via the `pipelineable` discriminator
 * and preserves chaining instead of forcing immediate await.
 */
export interface PipelineableNounProvider extends NounProvider {
  /** Whether this provider supports promise pipelining */
  readonly pipelineable: true

  /**
   * Get the raw RPC proxy for direct pipelined access.
   * Returns the underlying transport proxy (e.g., rpc.do RPCProxy)
   * that supports property chaining on unresolved promises.
   */
  getRpcProxy(): unknown

  /** Pipelined create — returns RpcPromise instead of bare Promise */
  create(type: string, data: Record<string, unknown>): RpcPromise<NounInstance>
  /** Pipelined get — returns RpcPromise instead of bare Promise */
  get(type: string, id: string): RpcPromise<NounInstance | null>
  /** Pipelined find — returns RpcPromise instead of bare Promise */
  find(type: string, where?: Record<string, unknown>): RpcPromise<NounInstance[]>
  /** Pipelined findOne — returns RpcPromise instead of bare Promise */
  findOne(type: string, where?: Record<string, unknown>): RpcPromise<NounInstance | null>
  /** Pipelined update — returns RpcPromise instead of bare Promise */
  update(type: string, id: string, data: Record<string, unknown>): RpcPromise<NounInstance>
  /** Pipelined delete — returns RpcPromise instead of bare Promise */
  delete(type: string, id: string): RpcPromise<boolean>
  /** Pipelined perform — returns RpcPromise instead of bare Promise */
  perform(type: string, verb: string, id: string, data?: Record<string, unknown>): RpcPromise<NounInstance>
  /** Pipelined rollback — returns RpcPromise instead of bare Promise */
  rollback(type: string, id: string, toVersion: number): RpcPromise<NounInstance>
}

/**
 * A batch context that collects operations for a single round-trip.
 *
 * Providers that support batching return this from their batch() method.
 * Operations performed within the batch callback are queued and flushed
 * together when the callback completes.
 */
export interface BatchContext {
  /** Flush all pending operations and return results */
  flush(): Promise<void>
  /** Number of operations currently queued */
  readonly pending: number
}

/**
 * Options for Noun() factory — allows scoped provider injection
 */
export interface NounOptions {
  /**
   * Override the global provider for this specific Noun.
   * Useful for multi-tenant setups where different tenants
   * use different providers/endpoints.
   */
  provider?: NounProvider | PipelineableNounProvider
}
