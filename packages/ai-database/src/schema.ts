/**
 * Schema-first Database Definition
 *
 * Declarative schema with automatic bi-directional relationships.
 * Uses mdxld conventions for entity structure.
 *
 * @example
 * ```ts
 * const { db } = DB({
 *   Post: {
 *     title: 'string',
 *     author: 'Author.posts',     // one-to-many: Post.author -> Author, Author.posts -> Post[]
 *     tags: ['Tag.posts'],        // many-to-many: Post.tags -> Tag[], Tag.posts -> Post[]
 *   },
 *   Author: {
 *     name: 'string',
 *     // posts: Post[] auto-created from backref
 *   },
 *   Tag: {
 *     name: 'string',
 *     // posts: Post[] auto-created from backref
 *   }
 * })
 *
 * // Typed access
 * const post = await db.Post.get('123')
 * post.author  // Author (single)
 * post.tags    // Tag[] (array)
 * ```
 */

import type { MDXLD } from 'mdxld'
import { DBPromise, wrapEntityOperations, type ForEachOptions, type ForEachResult } from './ai-promise-db.js'

// =============================================================================
// Re-exports from modular files
// =============================================================================

// Re-export types from types.ts
export type {
  ThingFlat,
  ThingExpanded,
  PrimitiveType,
  FieldDefinition,
  EntitySchema,
  DatabaseSchema,
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  Verb,
  Noun,
  NounProperty,
  NounRelationship,
  TypeMeta,
  // Graph Database Types
  EntityId,
  Thing,
  Relationship,
  // Query Types
  QueryOptions,
  ThingSearchOptions,
  CreateOptions,
  UpdateOptions,
  RelateOptions,
  // Event/Action/Artifact Types
  Event,
  ActionStatus,
  Action,
  ArtifactType,
  Artifact,
  // Options Types (Note: CreateEventOptions, CreateActionOptions defined locally below)
  StoreArtifactOptions,
  EventQueryOptions,
  ActionQueryOptions,
  // Client Interfaces
  DBClient,
  DBClientExtended,
  // Import with aliases to avoid conflict with local definitions
  CreateEventOptions as GraphCreateEventOptions,
  CreateActionOptions as GraphCreateActionOptions,
} from './types.js'

export { toExpanded, toFlat, Verbs, resolveUrl, resolveShortUrl, parseUrl } from './types.js'

// Re-export linguistic utilities from linguistic.ts
export {
  conjugate,
  pluralize,
  singularize,
  inferNoun,
  createTypeMeta,
  getTypeMeta,
  Type,
  getVerbFields,
} from './linguistic.js'

// Import for internal use
import type {
  ThingFlat,
  ThingExpanded,
  PrimitiveType,
  FieldDefinition,
  EntitySchema,
  DatabaseSchema,
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  Verb,
  Noun,
  NounProperty,
  NounRelationship,
  TypeMeta,
} from './types.js'

import { Verbs } from './types.js'

import {
  inferNoun,
  getTypeMeta,
  conjugate,
} from './linguistic.js'

/**
 * Create a Noun definition with type inference
 *
 * @example
 * ```ts
 * const Post = defineNoun({
 *   singular: 'post',
 *   plural: 'posts',
 *   description: 'A blog post',
 *   properties: {
 *     title: { type: 'string', description: 'Post title' },
 *     content: { type: 'markdown' },
 *   },
 *   relationships: {
 *     author: { type: 'Author', backref: 'posts' },
 *   },
 * })
 * ```
 */
export function defineNoun<T extends Noun>(noun: T): T {
  return noun
}

/**
 * Create a Verb definition with type inference
 *
 * @example
 * ```ts
 * const publish = defineVerb({
 *   action: 'publish',
 *   actor: 'publisher',
 *   act: 'publishes',
 *   activity: 'publishing',
 *   result: 'publication',
 *   reverse: { at: 'publishedAt', by: 'publishedBy' },
 *   inverse: 'unpublish',
 * })
 * ```
 */
export function defineVerb<T extends Verb>(verb: T): T {
  return verb
}

/**
 * Convert a Noun to an EntitySchema for use with DB()
 *
 * @example
 * ```ts
 * const postNoun = defineNoun({
 *   singular: 'post',
 *   plural: 'posts',
 *   properties: { title: { type: 'string' } },
 *   relationships: { author: { type: 'Author', backref: 'posts' } },
 * })
 *
 * const db = DB({
 *   Post: nounToSchema(postNoun),
 * })
 * ```
 */
export function nounToSchema(noun: Noun): EntitySchema {
  const schema: EntitySchema = {}

  // Add properties
  if (noun.properties) {
    for (const [name, prop] of Object.entries(noun.properties)) {
      let type = prop.type
      if (prop.array) type = `${type}[]`
      if (prop.optional) type = `${type}?`
      schema[name] = type
    }
  }

  // Add relationships
  if (noun.relationships) {
    for (const [name, rel] of Object.entries(noun.relationships)) {
      const baseType = rel.type.replace('[]', '')
      const isArray = rel.type.endsWith('[]')

      if (rel.backref) {
        schema[name] = isArray ? [`${baseType}.${rel.backref}`] : `${baseType}.${rel.backref}`
      } else {
        schema[name] = rel.type
      }
    }
  }

  return schema
}

// =============================================================================
// Built-in Schema Types - Self-Describing Database
// =============================================================================

/**
 * Built-in Thing schema - base type for all entities
 *
 * Every entity instance is a Thing with a relationship to its Noun.
 * This creates a complete graph: Thing.type -> Noun.things
 *
 * @example
 * ```ts
 * // Every post instance:
 * post.$type   // 'Post' (string)
 * post.type    // -> Noun('Post') (relationship)
 *
 * // From Noun, get all instances:
 * const postNoun = await db.Noun.get('Post')
 * const allPosts = await postNoun.things  // -> Post[]
 * ```
 */
export const ThingSchema: EntitySchema = {
  // Every Thing has a type that links to its Noun
  type: 'Noun.things',      // Thing.type -> Noun, Noun.things -> Thing[]
}

/**
 * Built-in Noun schema for storing type definitions
 *
 * Every Type/Collection automatically gets a Noun record stored in the database.
 * This enables introspection and self-describing schemas.
 *
 * @example
 * ```ts
 * // When you define:
 * const db = DB({ Post: { title: 'string' } })
 *
 * // The database auto-creates:
 * // db.Noun.get('Post') => { singular: 'post', plural: 'posts', ... }
 *
 * // Query all types:
 * const types = await db.Noun.list()
 *
 * // Get all instances of a type:
 * const postNoun = await db.Noun.get('Post')
 * const allPosts = await postNoun.things
 *
 * // Listen for new types:
 * on.Noun.created(noun => console.log(`New type: ${noun.name}`))
 * ```
 */
export const NounSchema: EntitySchema = {
  // Identity
  name: 'string',           // 'Post', 'BlogPost'
  singular: 'string',       // 'post', 'blog post'
  plural: 'string',         // 'posts', 'blog posts'
  slug: 'string',           // 'post', 'blog-post'
  slugPlural: 'string',     // 'posts', 'blog-posts'
  description: 'string?',   // Human description

  // Schema
  properties: 'json?',      // Property definitions
  relationships: 'json?',   // Relationship definitions

  // Behavior
  actions: 'json?',         // Available actions (verbs)
  events: 'json?',          // Event types

  // Metadata
  metadata: 'json?',        // Additional metadata

  // Relationships - auto-created by bi-directional system
  // things: Thing[]        // All instances of this type (backref from Thing.type)
}

/**
 * Built-in Verb schema for storing action definitions
 */
export const VerbSchema: EntitySchema = {
  action: 'string',         // 'create', 'publish'
  actor: 'string?',         // 'creator', 'publisher'
  act: 'string?',           // 'creates', 'publishes'
  activity: 'string?',      // 'creating', 'publishing'
  result: 'string?',        // 'creation', 'publication'
  reverse: 'json?',         // { at, by, in, for }
  inverse: 'string?',       // 'delete', 'unpublish'
  description: 'string?',
}

/**
 * Built-in Edge schema for relationships between types
 *
 * Every relationship in a schema creates an Edge record.
 * This enables graph queries across the type system.
 *
 * @example
 * ```ts
 * // Post.author -> Author creates:
 * // Edge { from: 'Post', name: 'author', to: 'Author', backref: 'posts', cardinality: 'many-to-one' }
 *
 * // Query the graph:
 * const edges = await db.Edge.find({ to: 'Author' })
 * // => [{ from: 'Post', name: 'author' }, { from: 'Comment', name: 'author' }]
 *
 * // What types reference Author?
 * const referencing = edges.map(e => e.from)  // ['Post', 'Comment']
 * ```
 */
export const EdgeSchema: EntitySchema = {
  from: 'string',           // Source type: 'Post'
  name: 'string',           // Field name: 'author'
  to: 'string',             // Target type: 'Author'
  backref: 'string?',       // Inverse field: 'posts'
  cardinality: 'string',    // 'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'
  required: 'boolean?',     // Is this relationship required?
  description: 'string?',   // Human description
}

/**
 * System types that are auto-created in every database
 *
 * The graph structure:
 * - Thing.type -> Noun (every instance links to its type)
 * - Noun.things -> Thing[] (every type has its instances)
 * - Edge connects Nouns (relationships between types)
 * - Verb describes actions on Nouns
 */
export const SystemSchema: DatabaseSchema = {
  Thing: ThingSchema,
  Noun: NounSchema,
  Verb: VerbSchema,
  Edge: EdgeSchema,
}

/**
 * Create Edge records from schema relationships
 *
 * @internal Used by DB() to auto-populate Edge records
 */
export function createEdgeRecords(
  typeName: string,
  schema: EntitySchema,
  parsedEntity: ParsedEntity
): Array<Record<string, unknown>> {
  const edges: Array<Record<string, unknown>> = []

  for (const [fieldName, field] of parsedEntity.fields) {
    if (field.isRelation && field.relatedType) {
      const cardinality = field.isArray
        ? field.backref ? 'many-to-many' : 'one-to-many'
        : field.backref ? 'many-to-one' : 'one-to-one'

      edges.push({
        from: typeName,
        name: fieldName,
        to: field.relatedType,
        backref: field.backref,
        cardinality,
      })
    }
  }

  return edges
}

/**
 * Create a Noun record from a type name and optional schema
 *
 * @internal Used by DB() to auto-populate Noun records
 */
export function createNounRecord(
  typeName: string,
  schema?: EntitySchema,
  nounDef?: Partial<Noun>
): Record<string, unknown> {
  const meta = getTypeMeta(typeName)
  const inferred = inferNoun(typeName)

  return {
    name: typeName,
    singular: nounDef?.singular ?? meta.singular,
    plural: nounDef?.plural ?? meta.plural,
    slug: meta.slug,
    slugPlural: meta.slugPlural,
    description: nounDef?.description,
    properties: nounDef?.properties ?? (schema ? schemaToProperties(schema) : undefined),
    relationships: nounDef?.relationships,
    actions: nounDef?.actions ?? inferred.actions,
    events: nounDef?.events ?? inferred.events,
    metadata: nounDef?.metadata,
  }
}

/**
 * Convert EntitySchema to NounProperty format
 */
function schemaToProperties(schema: EntitySchema): Record<string, NounProperty> {
  const properties: Record<string, NounProperty> = {}

  for (const [name, def] of Object.entries(schema)) {
    const defStr = Array.isArray(def) ? def[0] : def
    const isOptional = defStr.endsWith('?')
    const isArray = defStr.endsWith('[]') || Array.isArray(def)
    const baseType = defStr.replace(/[\?\[\]]/g, '').split('.')[0]!

    properties[name] = {
      type: baseType,
      optional: isOptional,
      array: isArray,
    }
  }

  return properties
}

// =============================================================================
// Schema Parsing
// =============================================================================

/**
 * Parse a single field definition
 */
function parseField(name: string, definition: FieldDefinition): ParsedField {
  // Handle array literal syntax: ['Author.posts']
  if (Array.isArray(definition)) {
    const inner = parseField(name, definition[0])
    return { ...inner, isArray: true }
  }

  let type = definition
  let isArray = false
  let isOptional = false
  let isRelation = false
  let relatedType: string | undefined
  let backref: string | undefined

  // Check for optional modifier
  if (type.endsWith('?')) {
    isOptional = true
    type = type.slice(0, -1)
  }

  // Check for array modifier (string syntax)
  if (type.endsWith('[]')) {
    isArray = true
    type = type.slice(0, -2)
  }

  // Check for relation (contains a dot for backref)
  if (type.includes('.')) {
    isRelation = true
    const [entityName, backrefName] = type.split('.')
    relatedType = entityName
    backref = backrefName
    type = entityName!
  } else if (type[0] === type[0]?.toUpperCase() && !isPrimitiveType(type)) {
    // PascalCase non-primitive = relation without explicit backref
    isRelation = true
    relatedType = type
  }

  return {
    name,
    type,
    isArray,
    isOptional,
    isRelation,
    relatedType,
    backref,
  }
}

/**
 * Check if a type is a primitive
 */
function isPrimitiveType(type: string): boolean {
  const primitives: PrimitiveType[] = [
    'string',
    'number',
    'boolean',
    'date',
    'datetime',
    'json',
    'markdown',
    'url',
  ]
  return primitives.includes(type as PrimitiveType)
}

/**
 * Parse a database schema and resolve bi-directional relationships
 */
export function parseSchema(schema: DatabaseSchema): ParsedSchema {
  const entities = new Map<string, ParsedEntity>()

  // First pass: parse all entities and their fields
  for (const [entityName, entitySchema] of Object.entries(schema)) {
    const fields = new Map<string, ParsedField>()

    for (const [fieldName, fieldDef] of Object.entries(entitySchema)) {
      fields.set(fieldName, parseField(fieldName, fieldDef))
    }

    entities.set(entityName, { name: entityName, fields })
  }

  // Second pass: create bi-directional relationships
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.backref) {
        const relatedEntity = entities.get(field.relatedType)
        if (relatedEntity && !relatedEntity.fields.has(field.backref)) {
          // Auto-create the inverse relation
          // If Post.author -> Author.posts, then Author.posts -> Post[]
          relatedEntity.fields.set(field.backref, {
            name: field.backref,
            type: entityName,
            isArray: true, // Backref is always an array
            isOptional: false,
            isRelation: true,
            relatedType: entityName,
            backref: fieldName, // Points back to the original field
          })
        }
      }
    }
  }

  return { entities }
}

// =============================================================================
// Type Generation (for TypeScript inference)
// =============================================================================

/**
 * Map field type to TypeScript type
 */
type FieldToTS<T extends string> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'date' | 'datetime'
        ? Date
        : T extends 'json'
          ? Record<string, unknown>
          : T extends 'markdown'
            ? string
            : T extends 'url'
              ? string
              : unknown

/**
 * Infer entity type from schema definition
 */
export type InferEntity<
  TSchema extends DatabaseSchema,
  TEntity extends keyof TSchema,
> = {
  $id: string
  $type: TEntity
} & {
  [K in keyof TSchema[TEntity]]: TSchema[TEntity][K] extends `${infer Type}.${string}`
    ? Type extends keyof TSchema
      ? InferEntity<TSchema, Type>
      : unknown
    : TSchema[TEntity][K] extends `${infer Type}[]`
      ? Type extends keyof TSchema
        ? InferEntity<TSchema, Type>[]
        : FieldToTS<Type>[]
      : TSchema[TEntity][K] extends `${infer Type}?`
        ? FieldToTS<Type> | undefined
        : FieldToTS<TSchema[TEntity][K] & string>
}

// =============================================================================
// Typed Operations
// =============================================================================

/**
 * Operations available on each entity type
 */
export interface EntityOperations<T> {
  /** Get an entity by ID */
  get(id: string): Promise<T | null>

  /** List all entities */
  list(options?: ListOptions): Promise<T[]>

  /** Find entities matching criteria */
  find(where: Partial<T>): Promise<T[]>

  /** Search entities */
  search(query: string, options?: SearchOptions): Promise<T[]>

  /** Create a new entity */
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Update an entity */
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>

  /** Upsert an entity */
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Delete an entity */
  delete(id: string): Promise<boolean>

  /** Iterate over entities */
  forEach(callback: (entity: T) => void | Promise<void>): Promise<void>
  forEach(
    options: ListOptions,
    callback: (entity: T) => void | Promise<void>
  ): Promise<void>
}

/**
 * Operations with promise pipelining support
 *
 * Query methods return DBPromise for chainable operations:
 * - `.map()` with batch optimization
 * - `.filter()`, `.sort()`, `.limit()`
 * - Property access tracking for projections
 *
 * @example
 * ```ts
 * // Chain without await
 * const leads = db.Lead.list()
 * const qualified = await leads
 *   .filter(l => l.score > 80)
 *   .map(l => ({ name: l.name, company: l.company }))
 *
 * // Batch relationship loading
 * const orders = await db.Order.list().map(o => ({
 *   order: o,
 *   customer: o.customer,  // Batch loaded!
 * }))
 * ```
 */
export interface PipelineEntityOperations<T> {
  /** Get an entity by ID */
  get(id: string): DBPromise<T | null>

  /** List all entities */
  list(options?: ListOptions): DBPromise<T[]>

  /** Find entities matching criteria */
  find(where: Partial<T>): DBPromise<T[]>

  /** Search entities */
  search(query: string, options?: SearchOptions): DBPromise<T[]>

  /** Get first matching entity */
  first(): DBPromise<T | null>

  /** Create a new entity */
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Update an entity */
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>

  /** Upsert an entity */
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Delete an entity */
  delete(id: string): Promise<boolean>

  /**
   * Process each entity with concurrency control, progress tracking, and error handling
   *
   * Designed for large-scale operations like AI generations or workflows.
   *
   * @example
   * ```ts
   * // Simple iteration
   * await db.Lead.forEach(lead => console.log(lead.name))
   *
   * // With AI and concurrency
   * const result = await db.Lead.forEach(async lead => {
   *   const analysis = await ai`analyze ${lead}`
   *   await db.Lead.update(lead.$id, { analysis })
   * }, {
   *   concurrency: 10,
   *   onProgress: p => console.log(`${p.completed}/${p.total}`),
   * })
   *
   * // With error handling
   * await db.Order.forEach(async order => {
   *   await sendInvoice(order)
   * }, {
   *   maxRetries: 3,
   *   onError: (err, order) => err.code === 'RATE_LIMIT' ? 'retry' : 'continue',
   * })
   * ```
   */
  forEach<U>(
    callback: (entity: T, index: number) => U | Promise<U>,
    options?: ForEachOptions<T>
  ): Promise<ForEachResult>
}

export interface ListOptions {
  where?: Record<string, unknown>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchOptions extends ListOptions {
  fields?: string[]
  minScore?: number
}

// =============================================================================
// Database Client Type
// =============================================================================

/**
 * Natural language query result
 */
export interface NLQueryResult<T = unknown> {
  /** The interpreted query */
  interpretation: string
  /** Confidence in the interpretation (0-1) */
  confidence: number
  /** The results */
  results: T[]
  /** SQL/filter equivalent (for debugging) */
  query?: string
  /** Explanation of what was found */
  explanation?: string
}

/**
 * Tagged template for natural language queries
 *
 * @example
 * ```ts
 * // Query across all types
 * const results = await db`what is happening with joe in ca?`
 *
 * // Query specific type
 * const orders = await db.Orders`what pending orders are delayed?`
 *
 * // With interpolation
 * const name = 'joe'
 * const results = await db`find all orders for ${name}`
 * ```
 */
export type NLQueryFn<T = unknown> = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<NLQueryResult<T>>

/**
 * Typed database client based on schema
 *
 * Entity operations return DBPromise for chainable queries:
 * ```ts
 * const { db } = DB({ Lead: { name: 'string', company: 'Company.leads' } })
 *
 * // Chain without await
 * const leads = db.Lead.list()
 * const qualified = await leads.filter(l => l.score > 80)
 *
 * // Batch relationship loading
 * const withCompanies = await leads.map(l => ({
 *   lead: l,
 *   company: l.company,  // Batch loaded!
 * }))
 * ```
 */
export type TypedDB<TSchema extends DatabaseSchema> = {
  [K in keyof TSchema]: PipelineEntityOperations<InferEntity<TSchema, K>> & NLQueryFn<InferEntity<TSchema, K>>
} & {
  /** The parsed schema */
  readonly $schema: ParsedSchema

  /** Get any entity by URL */
  get(url: string): Promise<unknown>

  /** Search across all entities */
  search(query: string, options?: SearchOptions): Promise<unknown[]>

  /** Count entities of a type */
  count(type: string, where?: Record<string, unknown>): Promise<number>

  /** Iterate over entities with a callback */
  forEach(
    options: { type: string; where?: Record<string, unknown>; concurrency?: number },
    callback: (entity: unknown) => void | Promise<void>
  ): Promise<void>

  /** Set entity data by ID (creates or replaces) */
  set(type: string, id: string, data: Record<string, unknown>): Promise<unknown>

  /** Generate entities using AI */
  generate(options: GenerateOptions): Promise<unknown | { id: string }>

  /**
   * Natural language query across all types
   *
   * @example
   * ```ts
   * const results = await db`what orders are pending for customers in california?`
   * const results = await db`show me joe's recent activity`
   * const results = await db`what changed in the last hour?`
   * ```
   */
  ask: NLQueryFn
}

/**
 * Options for AI-powered entity generation
 */
export interface GenerateOptions {
  type: string
  count?: number
  data?: Record<string, unknown>
  mode?: 'sync' | 'background'
}

// =============================================================================
// Events API (Actor-Event-Object-Result pattern)
// =============================================================================

/**
 * Actor data - who performed the action
 *
 * @example
 * ```ts
 * const actorData: ActorData = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   org: 'Acme Corp',
 *   role: 'admin',
 * }
 * ```
 */
export interface ActorData {
  /** Actor's display name */
  name?: string
  /** Actor's email */
  email?: string
  /** Actor's organization */
  org?: string
  /** Actor's role or access level */
  role?: string
  /** Additional actor metadata */
  [key: string]: unknown
}

/**
 * Event data structure - Actor-Event-Object-Result pattern
 *
 * Following ActivityStreams semantics:
 * - Actor: Who did it (user, system, agent)
 * - Event: What happened (created, updated, published)
 * - Object: What it was done to (the entity)
 * - Result: What was the outcome (optional)
 *
 * @example
 * ```ts
 * const event: DBEvent = {
 *   id: '01HGXYZ...',
 *   actor: 'user:john',
 *   actorData: { name: 'John Doe', email: 'john@example.com' },
 *   event: 'Post.published',
 *   object: 'https://example.com/Post/hello-world',
 *   objectData: { title: 'Hello World' },
 *   result: 'https://example.com/Publication/123',
 *   resultData: { url: 'https://blog.example.com/hello-world' },
 *   timestamp: new Date(),
 * }
 * ```
 */
export interface DBEvent {
  /** Unique event ID (ULID recommended) */
  id: string
  /** Actor identifier (user:id, system, agent:name) */
  actor: string
  /** Actor metadata */
  actorData?: ActorData
  /** Event type (Entity.action format, e.g., Post.created) */
  event: string
  /** Object URL/identifier that was acted upon */
  object?: string
  /** Object data snapshot at time of event */
  objectData?: Record<string, unknown>
  /** Result URL/identifier (outcome of the action) */
  result?: string
  /** Result data */
  resultData?: Record<string, unknown>
  /** Additional metadata */
  meta?: Record<string, unknown>
  /** When the event occurred */
  timestamp: Date

  // Legacy compatibility (deprecated)
  /** @deprecated Use 'event' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
  /** @deprecated Use 'object' instead */
  url?: string
}

/**
 * Options for creating an event
 */
export interface CreateEventOptions {
  /** Actor identifier */
  actor: string
  /** Actor metadata */
  actorData?: ActorData
  /** Event type */
  event: string
  /** Object URL/identifier */
  object?: string
  /** Object data */
  objectData?: Record<string, unknown>
  /** Result URL/identifier */
  result?: string
  /** Result data */
  resultData?: Record<string, unknown>
  /** Additional metadata */
  meta?: Record<string, unknown>
}

/**
 * Events API for subscribing to and emitting events
 */
export interface EventsAPI {
  /** Subscribe to events matching a pattern */
  on(pattern: string, handler: (event: DBEvent) => void | Promise<void>): () => void

  /** Emit an event using Actor-Event-Object-Result pattern */
  emit(options: CreateEventOptions): Promise<DBEvent>

  /** Emit a simple event (legacy compatibility) */
  emit(type: string, data: unknown): Promise<DBEvent>

  /** List events with optional filters */
  list(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
    /** @deprecated Use 'event' instead */
    type?: string
  }): Promise<DBEvent[]>

  /** Replay events through a handler */
  replay(options: {
    event?: string
    actor?: string
    since?: Date
    handler: (event: DBEvent) => void | Promise<void>
    /** @deprecated Use 'event' instead */
    type?: string
  }): Promise<void>
}

// =============================================================================
// Actions API (Linguistic Verb Pattern)
// =============================================================================

/**
 * Action data structure for durable execution
 *
 * Uses linguistic verb conjugations for semantic clarity:
 * - act: Present tense 3rd person (creates, publishes)
 * - action: Base verb form (create, publish)
 * - activity: Gerund/progressive (creating, publishing)
 *
 * @example
 * ```ts
 * const action: DBAction = {
 *   id: '01HGXYZ...',
 *   actor: 'user:john',
 *   actorData: { name: 'John Doe' },
 *   // Verb conjugations
 *   act: 'generates',        // Present tense: "system generates posts"
 *   action: 'generate',      // Base form for lookups
 *   activity: 'generating',  // Progressive: "currently generating posts"
 *   // Target
 *   object: 'Post',
 *   objectData: { count: 100 },
 *   // Status
 *   status: 'active',
 *   progress: 50,
 *   total: 100,
 *   // Result
 *   result: { created: 50 },
 *   timestamp: new Date(),
 * }
 * ```
 */
export interface DBAction {
  /** Unique action ID (ULID recommended) */
  id: string

  /** Actor identifier (user:id, system, agent:name) */
  actor: string
  /** Actor metadata */
  actorData?: ActorData

  /** Present tense 3rd person verb (creates, publishes, generates) */
  act: string
  /** Base verb form - imperative (create, publish, generate) */
  action: string
  /** Gerund/progressive form (creating, publishing, generating) */
  activity: string

  /** Object being acted upon (type name or URL) */
  object?: string
  /** Object data/parameters for the action */
  objectData?: Record<string, unknown>

  /** Action status */
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'

  /** Current progress count */
  progress?: number
  /** Total items to process */
  total?: number

  /** Result data on completion */
  result?: Record<string, unknown>
  /** Error message on failure */
  error?: string

  /** Additional metadata */
  meta?: Record<string, unknown>

  /** When the action was created */
  createdAt: Date
  /** When the action started executing */
  startedAt?: Date
  /** When the action completed/failed */
  completedAt?: Date

  // Legacy compatibility (deprecated)
  /** @deprecated Use 'action' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

/**
 * Options for creating an action
 */
export interface CreateActionOptions {
  /** Actor identifier */
  actor: string
  /** Actor metadata */
  actorData?: ActorData
  /** Base verb (will auto-conjugate to act/activity) */
  action: string
  /** Object being acted upon */
  object?: string
  /** Object data/parameters */
  objectData?: Record<string, unknown>
  /** Total items for progress tracking */
  total?: number
  /** Additional metadata */
  meta?: Record<string, unknown>

  // Legacy compatibility
  /** @deprecated Use 'action' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

/**
 * Actions API for durable execution tracking
 *
 * @example
 * ```ts
 * // Create an action with verb conjugation
 * const action = await actions.create({
 *   actor: 'system',
 *   action: 'generate',  // auto-conjugates to act='generates', activity='generating'
 *   object: 'Post',
 *   objectData: { count: 100 },
 *   total: 100,
 * })
 *
 * // Update progress
 * await actions.update(action.id, { progress: 50 })
 *
 * // Complete with result
 * await actions.update(action.id, {
 *   status: 'completed',
 *   result: { created: 100 },
 * })
 * ```
 */
export interface ActionsAPI {
  /** Create a new action (auto-conjugates verb forms) */
  create(options: CreateActionOptions): Promise<DBAction>

  /** Create with legacy format (deprecated) */
  create(data: { type: string; data: unknown; total?: number }): Promise<DBAction>

  /** Get an action by ID */
  get(id: string): Promise<DBAction | null>

  /** Update action progress/status */
  update(
    id: string,
    updates: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>>
  ): Promise<DBAction>

  /** List actions with optional filters */
  list(options?: {
    status?: DBAction['status']
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
    /** @deprecated Use 'action' instead */
    type?: string
  }): Promise<DBAction[]>

  /** Retry a failed action */
  retry(id: string): Promise<DBAction>

  /** Cancel a pending/active action */
  cancel(id: string): Promise<void>

  /** Conjugate a verb to get all forms */
  conjugate(action: string): Verb
}

// =============================================================================
// Artifacts API
// =============================================================================

/**
 * Artifact data structure for cached content
 */
export interface DBArtifact {
  url: string
  type: string
  sourceHash: string
  content: unknown
  metadata?: Record<string, unknown>
  createdAt: Date
}

/**
 * Artifacts API for cached embeddings and computed content
 */
export interface ArtifactsAPI {
  /** Get an artifact by URL and type */
  get(url: string, type: string): Promise<DBArtifact | null>

  /** Set an artifact */
  set(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void>

  /** Delete an artifact */
  delete(url: string, type?: string): Promise<void>

  /** List artifacts for a URL */
  list(url: string): Promise<DBArtifact[]>
}

// =============================================================================
// Nouns API
// =============================================================================

/**
 * Nouns API for type introspection
 */
export interface NounsAPI {
  /** Get a noun definition by type name */
  get(name: string): Promise<Noun | null>

  /** List all noun definitions */
  list(): Promise<Noun[]>

  /** Define a new noun */
  define(noun: Noun): Promise<void>
}

// =============================================================================
// Verbs API
// =============================================================================

/**
 * Verbs API for action introspection
 */
export interface VerbsAPI {
  /** Get a verb definition by action name */
  get(action: string): Verb | null

  /** List all verb definitions */
  list(): Verb[]

  /** Define a new verb */
  define(verb: Verb): void

  /** Conjugate a verb from base form */
  conjugate(action: string): Verb
}

// =============================================================================
// DB Result Type
// =============================================================================

/**
 * Result of DB() factory - supports both direct and destructured usage
 *
 * @example
 * ```ts
 * // Direct usage - everything on one object
 * const db = DB(schema)
 * db.User.create(...)      // entity operations
 * db.events.on(...)        // events API
 * db.actions.create(...)   // actions API
 *
 * // Destructured usage - cleaner separation
 * const { db, events, actions } = DB(schema)
 * db.User.create(...)      // just entity ops
 * events.on(...)           // separate events
 * ```
 */
export type DBResult<TSchema extends DatabaseSchema> = TypedDB<TSchema> & {
  /** Self-reference for destructuring - same as the parent object but cleaner semantically */
  db: TypedDB<TSchema>

  /** Event subscription and emission */
  events: EventsAPI

  /** Durable action execution */
  actions: ActionsAPI

  /** Cached embeddings and computed content */
  artifacts: ArtifactsAPI

  /** Type introspection */
  nouns: NounsAPI

  /** Action introspection */
  verbs: VerbsAPI
}

// =============================================================================
// Natural Language Query Implementation
// =============================================================================

/**
 * AI generator function type for NL queries
 * This is injected by the user or resolved from environment
 */
export type NLQueryGenerator = (prompt: string, context: NLQueryContext) => Promise<NLQueryPlan>

/**
 * Context provided to the AI for query generation
 */
export interface NLQueryContext {
  /** Available types with their schemas */
  types: Array<{
    name: string
    singular: string
    plural: string
    fields: string[]
    relationships: Array<{ name: string; to: string; cardinality: string }>
  }>
  /** The specific type being queried (if any) */
  targetType?: string
  /** Recent events for context */
  recentEvents?: Array<{ type: string; timestamp: Date }>
}

/**
 * Query plan generated by AI
 */
export interface NLQueryPlan {
  /** Types to query */
  types: string[]
  /** Filters to apply */
  filters?: Record<string, unknown>
  /** Search terms */
  search?: string
  /** Time range */
  timeRange?: { since?: Date; until?: Date }
  /** Relationships to follow */
  include?: string[]
  /** How to interpret results */
  interpretation: string
  /** Confidence score */
  confidence: number
}

let nlQueryGenerator: NLQueryGenerator | null = null

/**
 * Set the AI generator for natural language queries
 *
 * @example
 * ```ts
 * import { generate } from 'ai-functions'
 *
 * setNLQueryGenerator(async (prompt, context) => {
 *   return generate({
 *     prompt: `Given this schema: ${JSON.stringify(context.types)}
 *              Answer this question: ${prompt}
 *              Return a query plan as JSON.`,
 *     schema: NLQueryPlanSchema
 *   })
 * })
 * ```
 */
export function setNLQueryGenerator(generator: NLQueryGenerator): void {
  nlQueryGenerator = generator
}

/**
 * Build schema context for NL queries
 */
function buildNLQueryContext(schema: ParsedSchema, targetType?: string): NLQueryContext {
  const types: NLQueryContext['types'] = []

  for (const [name, entity] of schema.entities) {
    const fields: string[] = []
    const relationships: NLQueryContext['types'][0]['relationships'] = []

    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType) {
        relationships.push({
          name: fieldName,
          to: field.relatedType,
          cardinality: field.isArray ? 'many' : 'one',
        })
      } else {
        fields.push(fieldName)
      }
    }

    const meta = getTypeMeta(name)
    types.push({
      name,
      singular: meta.singular,
      plural: meta.plural,
      fields,
      relationships,
    })
  }

  return { types, targetType }
}

/**
 * Execute a natural language query
 */
async function executeNLQuery<T>(
  question: string,
  schema: ParsedSchema,
  targetType?: string
): Promise<NLQueryResult<T>> {
  // If no AI generator configured, fall back to search
  if (!nlQueryGenerator) {
    // Simple fallback: search across all types or target type
    const provider = await resolveProvider()
    const results: T[] = []

    if (targetType) {
      const searchResults = await provider.search(targetType, question)
      results.push(...(searchResults as T[]))
    } else {
      for (const [typeName] of schema.entities) {
        const searchResults = await provider.search(typeName, question)
        results.push(...(searchResults as T[]))
      }
    }

    return {
      interpretation: `Search for "${question}"`,
      confidence: 0.5,
      results,
      explanation: 'Fallback to keyword search (no AI generator configured)',
    }
  }

  // Build context and get AI-generated query plan
  const context = buildNLQueryContext(schema, targetType)
  const plan = await nlQueryGenerator(question, context)

  // Execute the plan
  const provider = await resolveProvider()
  const results: T[] = []

  for (const typeName of plan.types) {
    let typeResults: Record<string, unknown>[]

    if (plan.search) {
      typeResults = await provider.search(typeName, plan.search, {
        where: plan.filters,
      })
    } else {
      typeResults = await provider.list(typeName, {
        where: plan.filters,
      })
    }

    results.push(...(typeResults as T[]))
  }

  return {
    interpretation: plan.interpretation,
    confidence: plan.confidence,
    results,
    query: JSON.stringify({ types: plan.types, filters: plan.filters, search: plan.search }),
  }
}

/**
 * Create a natural language query function for a specific type
 */
function createNLQueryFn<T>(
  schema: ParsedSchema,
  typeName?: string
): NLQueryFn<T> {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Interpolate the template
    const question = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? String(values[i]) : '')
    }, '')

    return executeNLQuery<T>(question, schema, typeName)
  }
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Database provider interface that adapters must implement
 */
export interface DBProvider {
  /** Get an entity */
  get(type: string, id: string): Promise<Record<string, unknown> | null>

  /** List entities */
  list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]>

  /** Search entities */
  search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]>

  /** Create an entity */
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Update an entity */
  update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Delete an entity */
  delete(type: string, id: string): Promise<boolean>

  /** Get related entities */
  related(
    type: string,
    id: string,
    relation: string
  ): Promise<Record<string, unknown>[]>

  /** Create a relationship */
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>

  /** Remove a relationship */
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
}

// =============================================================================
// Provider Resolution
// =============================================================================

let globalProvider: DBProvider | null = null
let providerPromise: Promise<DBProvider> | null = null

/** File count threshold for suggesting ClickHouse upgrade */
const FILE_COUNT_THRESHOLD = 10_000

/**
 * Set the global database provider
 */
export function setProvider(provider: DBProvider): void {
  globalProvider = provider
  providerPromise = null
}

/**
 * Parsed DATABASE_URL
 */
interface ParsedDatabaseUrl {
  provider: 'fs' | 'sqlite' | 'clickhouse' | 'memory'
  /** Content root directory */
  root: string
  /** Remote URL for Turso/ClickHouse HTTP */
  remoteUrl?: string
}

/**
 * Parse DATABASE_URL into provider type and paths
 *
 * Local storage (all use .db/ folder):
 * - `./content` → fs (default)
 * - `sqlite://./content` → sqlite stored in ./content/.db/index.sqlite
 * - `chdb://./content` → clickhouse stored in ./content/.db/clickhouse/
 *
 * Remote:
 * - `libsql://your-db.turso.io` → Turso SQLite
 * - `clickhouse://host:8123` → ClickHouse HTTP
 * - `:memory:` → in-memory
 */
function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) return { provider: 'fs', root: './content' }

  // In-memory
  if (url === ':memory:') {
    return { provider: 'memory', root: '' }
  }

  // Remote Turso
  if (url.startsWith('libsql://') || url.includes('.turso.io')) {
    return { provider: 'sqlite', root: '', remoteUrl: url }
  }

  // Remote ClickHouse
  if (url.startsWith('clickhouse://') && url.includes(':')) {
    // clickhouse://host:port/db
    return { provider: 'clickhouse', root: '', remoteUrl: url.replace('clickhouse://', 'https://') }
  }

  // Local SQLite: sqlite://./content → ./content/.db/index.sqlite
  if (url.startsWith('sqlite://')) {
    const root = url.replace('sqlite://', '') || './content'
    return { provider: 'sqlite', root }
  }

  // Local ClickHouse (chDB): chdb://./content → ./content/.db/clickhouse/
  if (url.startsWith('chdb://')) {
    const root = url.replace('chdb://', '') || './content'
    return { provider: 'clickhouse', root }
  }

  // Default: filesystem
  return { provider: 'fs', root: url }
}

/**
 * Resolve provider from DATABASE_URL environment variable
 *
 * @example
 * ```bash
 * # Filesystem (default) - stores in ./content with .db/ metadata
 * DATABASE_URL=./content
 *
 * # Local SQLite - stores in ./content/.db/index.sqlite
 * DATABASE_URL=sqlite://./content
 *
 * # Remote Turso
 * DATABASE_URL=libsql://your-db.turso.io
 *
 * # Local ClickHouse (chDB) - stores in ./content/.db/clickhouse/
 * DATABASE_URL=chdb://./content
 *
 * # Remote ClickHouse
 * DATABASE_URL=clickhouse://localhost:8123
 *
 * # In-memory (testing)
 * DATABASE_URL=:memory:
 * ```
 */
async function resolveProvider(): Promise<DBProvider> {
  if (globalProvider) return globalProvider

  if (providerPromise) return providerPromise

  providerPromise = (async () => {
    const databaseUrl =
      (typeof process !== 'undefined' && process.env?.DATABASE_URL) || './content'

    const parsed = parseDatabaseUrl(databaseUrl)

    switch (parsed.provider) {
      case 'memory': {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
        break
      }

      case 'fs': {
        try {
          const { createFsProvider } = await import('@mdxdb/fs' as any)
          globalProvider = createFsProvider({ root: parsed.root })

          // Check file count and warn if approaching threshold
          checkFileCountThreshold(parsed.root)
        } catch (err) {
          console.warn('@mdxdb/fs not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'sqlite': {
        try {
          const { createSqliteProvider } = await import('@mdxdb/sqlite' as any)

          if (parsed.remoteUrl) {
            // Remote Turso
            globalProvider = await createSqliteProvider({ url: parsed.remoteUrl })
          } else {
            // Local SQLite in .db folder
            const dbPath = `${parsed.root}/.db/index.sqlite`
            globalProvider = await createSqliteProvider({ url: `file:${dbPath}` })
          }
        } catch (err) {
          console.warn('@mdxdb/sqlite not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'clickhouse': {
        try {
          const { createClickhouseProvider } = await import('@mdxdb/clickhouse' as any)

          if (parsed.remoteUrl) {
            // Remote ClickHouse
            globalProvider = await createClickhouseProvider({
              mode: 'http',
              url: parsed.remoteUrl,
            })
          } else {
            // Local chDB in .db folder
            const dbPath = `${parsed.root}/.db/clickhouse`
            globalProvider = await createClickhouseProvider({
              mode: 'chdb',
              url: dbPath,
            })
          }
        } catch (err) {
          console.warn('@mdxdb/clickhouse not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      default: {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
      }
    }

    return globalProvider!
  })()

  return providerPromise
}

/**
 * Check file count and warn if approaching threshold
 */
async function checkFileCountThreshold(root: string): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function countFiles(dir: string): Promise<number> {
      let count = 0
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (entry.isDirectory()) {
            count += await countFiles(path.join(dir, entry.name))
          } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
            count++
          }
        }
      } catch {
        // Directory doesn't exist yet
      }
      return count
    }

    const count = await countFiles(root)
    if (count > FILE_COUNT_THRESHOLD) {
      console.warn(
        `\n⚠️  You have ${count.toLocaleString()} MDX files. ` +
        `Consider upgrading to ClickHouse for better performance:\n` +
        `   DATABASE_URL=chdb://./data/clickhouse\n`
      )
    }
  } catch {
    // Ignore errors in file counting
  }
}

// =============================================================================
// DB Factory
// =============================================================================

/**
 * Create a typed database from a schema definition
 *
 * Supports both direct usage and destructuring for flexibility:
 *
 * @example Direct usage - everything on one object
 * ```ts
 * const db = DB({
 *   Post: { title: 'string', author: 'Author.posts' },
 *   Author: { name: 'string' },
 * })
 *
 * // Entity operations
 * const post = await db.Post.create({ title: 'Hello' })
 *
 * // Events, actions, etc. are also available directly
 * db.events.on('Post.created', (event) => console.log(event))
 * db.actions.create({ type: 'generate', data: {} })
 * ```
 *
 * @example Destructured usage - cleaner separation
 * ```ts
 * const { db, events, actions, artifacts, nouns, verbs } = DB({
 *   Post: { title: 'string', author: 'Author.posts' },
 *   Author: { name: 'string' },
 * })
 *
 * // CRUD operations on db
 * const post = await db.Post.create({ title: 'Hello' })
 * await db.Post.update(post.$id, { title: 'Updated' })
 *
 * // Separate events API
 * events.on('Post.created', (event) => console.log(event))
 *
 * // Separate actions API
 * const action = await actions.create({ type: 'generate', data: {} })
 * ```
 */
export function DB<TSchema extends DatabaseSchema>(
  schema: TSchema
): DBResult<TSchema> {
  const parsedSchema = parseSchema(schema)

  // Create Actions API early so it can be injected into entity operations
  const actionsAPI = {
    async create(options: CreateActionOptions | { type: string; data: unknown; total?: number }) {
      const provider = await resolveProvider()
      if ('createAction' in provider) {
        return (provider as any).createAction(options)
      }
      throw new Error('Provider does not support actions')
    },
    async get(id: string) {
      const provider = await resolveProvider()
      if ('getAction' in provider) {
        return (provider as any).getAction(id)
      }
      return null
    },
    async update(id: string, updates: unknown) {
      const provider = await resolveProvider()
      if ('updateAction' in provider) {
        return (provider as any).updateAction(id, updates)
      }
      throw new Error('Provider does not support actions')
    },
  }

  // Create entity operations for each type with promise pipelining
  const entityOperations: Record<string, PipelineEntityOperations<unknown>> = {}

  for (const [entityName, entity] of parsedSchema.entities) {
    const baseOps = createEntityOperations(entityName, entity, parsedSchema)
    // Wrap with DBPromise for chainable queries, inject actions for forEach persistence
    entityOperations[entityName] = wrapEntityOperations(entityName, baseOps, actionsAPI)
  }

  // Noun definitions cache
  const nounDefinitions = new Map<string, Noun>()

  // Initialize nouns from schema
  for (const [entityName] of parsedSchema.entities) {
    const noun = inferNoun(entityName)
    nounDefinitions.set(entityName, noun)
  }

  // Verb definitions cache
  const verbDefinitions = new Map<string, Verb>(
    Object.entries(Verbs).map(([k, v]) => [k, v])
  )

  // Create the typed DB object
  const db = {
    $schema: parsedSchema,

    async get(url: string) {
      const provider = await resolveProvider()
      const parsed = parseUrl(url)
      return provider.get(parsed.type, parsed.id)
    },

    async search(query: string, options?: SearchOptions) {
      const provider = await resolveProvider()
      const results: unknown[] = []
      for (const [typeName] of parsedSchema.entities) {
        const typeResults = await provider.search(typeName, query, options)
        results.push(...typeResults)
      }
      return results
    },

    async count(type: string, where?: Record<string, unknown>) {
      const provider = await resolveProvider()
      const results = await provider.list(type, { where })
      return results.length
    },

    async forEach(
      options: { type: string; where?: Record<string, unknown>; concurrency?: number },
      callback: (entity: unknown) => void | Promise<void>
    ) {
      const provider = await resolveProvider()
      const results = await provider.list(options.type, { where: options.where })
      const concurrency = options.concurrency ?? 1

      if (concurrency === 1) {
        for (const entity of results) {
          await callback(entity)
        }
      } else {
        // Process in batches with concurrency
        const { Semaphore } = await import('./memory-provider.js')
        const semaphore = new Semaphore(concurrency)
        await semaphore.map(results, callback as (item: Record<string, unknown>) => Promise<void>)
      }
    },

    async set(type: string, id: string, data: Record<string, unknown>) {
      const provider = await resolveProvider()
      const existing = await provider.get(type, id)
      if (existing) {
        // Replace entirely (not merge)
        return provider.update(type, id, data)
      }
      return provider.create(type, id, data)
    },

    async generate(options: GenerateOptions) {
      // Placeholder - actual AI generation would be implemented here
      // For now, just create with provided data
      const provider = await resolveProvider()
      if (options.mode === 'background') {
        // Return action ID for tracking
        const { createMemoryProvider } = await import('./memory-provider.js')
        const memProvider = provider as ReturnType<typeof createMemoryProvider>
        if ('createAction' in memProvider) {
          return memProvider.createAction({
            type: 'generate',
            data: options,
            total: options.count ?? 1,
          })
        }
      }
      // Sync mode - create single entity
      return provider.create(options.type, undefined, options.data ?? {})
    },

    ask: createNLQueryFn(parsedSchema),

    ...entityOperations,
  } as TypedDB<TSchema>

  // Create Events API
  const events: EventsAPI = {
    on(pattern, handler) {
      // Get provider and delegate - need async resolution
      let unsubscribe = () => {}
      resolveProvider().then((provider) => {
        if ('on' in provider) {
          unsubscribe = (provider as any).on(pattern, handler)
        }
      })
      return () => unsubscribe()
    },

    async emit(optionsOrType: CreateEventOptions | string, data?: unknown): Promise<DBEvent> {
      const provider = await resolveProvider()
      if ('emit' in provider) {
        return (provider as any).emit(optionsOrType, data)
      }
      // Return minimal event if provider doesn't support emit
      const now = new Date()
      if (typeof optionsOrType === 'string') {
        return {
          id: crypto.randomUUID(),
          actor: 'system',
          event: optionsOrType,
          objectData: data as Record<string, unknown> | undefined,
          timestamp: now,
        }
      }
      return {
        id: crypto.randomUUID(),
        actor: optionsOrType.actor,
        actorData: optionsOrType.actorData,
        event: optionsOrType.event,
        object: optionsOrType.object,
        objectData: optionsOrType.objectData,
        result: optionsOrType.result,
        resultData: optionsOrType.resultData,
        meta: optionsOrType.meta,
        timestamp: now,
      }
    },

    async list(options) {
      const provider = await resolveProvider()
      if ('listEvents' in provider) {
        return (provider as any).listEvents(options)
      }
      return []
    },

    async replay(options) {
      const provider = await resolveProvider()
      if ('replayEvents' in provider) {
        await (provider as any).replayEvents(options)
      }
    },
  }

  // Create Actions API (extends actionsAPI with list, retry, cancel)
  const actions: ActionsAPI = {
    ...actionsAPI,

    async list(options) {
      const provider = await resolveProvider()
      if ('listActions' in provider) {
        return (provider as any).listActions(options)
      }
      return []
    },

    async retry(id) {
      const provider = await resolveProvider()
      if ('retryAction' in provider) {
        return (provider as any).retryAction(id)
      }
      throw new Error('Provider does not support actions')
    },

    async cancel(id) {
      const provider = await resolveProvider()
      if ('cancelAction' in provider) {
        await (provider as any).cancelAction(id)
      }
    },

    conjugate,
  }

  // Create Artifacts API
  const artifacts: ArtifactsAPI = {
    async get(url, type) {
      const provider = await resolveProvider()
      if ('getArtifact' in provider) {
        return (provider as any).getArtifact(url, type)
      }
      return null
    },

    async set(url, type, data) {
      const provider = await resolveProvider()
      if ('setArtifact' in provider) {
        await (provider as any).setArtifact(url, type, data)
      }
    },

    async delete(url, type) {
      const provider = await resolveProvider()
      if ('deleteArtifact' in provider) {
        await (provider as any).deleteArtifact(url, type)
      }
    },

    async list(url) {
      const provider = await resolveProvider()
      if ('listArtifacts' in provider) {
        return (provider as any).listArtifacts(url)
      }
      return []
    },
  }

  // Create Nouns API
  const nouns: NounsAPI = {
    async get(name) {
      return nounDefinitions.get(name) ?? null
    },

    async list() {
      return Array.from(nounDefinitions.values())
    },

    async define(noun) {
      nounDefinitions.set(noun.singular, noun)
    },
  }

  // Create Verbs API
  const verbs: VerbsAPI = {
    get(action) {
      return verbDefinitions.get(action) ?? null
    },

    list() {
      return Array.from(verbDefinitions.values())
    },

    define(verb) {
      verbDefinitions.set(verb.action, verb)
    },

    conjugate,
  }

  // Return combined object that supports both direct usage and destructuring
  // db.User.create() works, db.events.on() works
  // const { db, events } = DB(...) also works
  return Object.assign(db, {
    db, // self-reference for destructuring
    events,
    actions,
    artifacts,
    nouns,
    verbs,
  }) as DBResult<TSchema>
}

/**
 * Parse a URL into type and id
 */
function parseUrl(url: string): { type: string; id: string } {
  // Handle full URLs
  if (url.includes('://')) {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return {
      type: parts[0] || '',
      id: parts.slice(1).join('/'),
    }
  }

  // Handle type/id format
  if (url.includes('/')) {
    const parts = url.split('/')
    return {
      type: parts[0]!,
      id: parts.slice(1).join('/'),
    }
  }

  // Just id
  return { type: '', id: url }
}

/**
 * Create operations for a single entity type
 */
function createEntityOperations<T>(
  typeName: string,
  entity: ParsedEntity,
  schema: ParsedSchema
): EntityOperations<T> {
  return {
    async get(id: string): Promise<T | null> {
      const provider = await resolveProvider()
      const result = await provider.get(typeName, id)
      if (!result) return null
      return hydrateEntity(result, entity, schema) as T
    },

    async list(options?: ListOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async find(where: Partial<T>): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, {
        where: where as Record<string, unknown>,
      })
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async search(query: string, options?: SearchOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.search(typeName, query, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async create(
      idOrData: string | Omit<T, '$id' | '$type'>,
      maybeData?: Omit<T, '$id' | '$type'>
    ): Promise<T> {
      const provider = await resolveProvider()
      const id = typeof idOrData === 'string' ? idOrData : undefined
      const data =
        typeof idOrData === 'string'
          ? (maybeData as Record<string, unknown>)
          : (idOrData as Record<string, unknown>)

      const result = await provider.create(typeName, id, data)
      return hydrateEntity(result, entity, schema) as T
    },

    async update(
      id: string,
      data: Partial<Omit<T, '$id' | '$type'>>
    ): Promise<T> {
      const provider = await resolveProvider()
      const result = await provider.update(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T> {
      const provider = await resolveProvider()
      const existing = await provider.get(typeName, id)
      if (existing) {
        const result = await provider.update(
          typeName,
          id,
          data as Record<string, unknown>
        )
        return hydrateEntity(result, entity, schema) as T
      }
      const result = await provider.create(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async delete(id: string): Promise<boolean> {
      const provider = await resolveProvider()
      return provider.delete(typeName, id)
    },

    async forEach(
      optionsOrCallback:
        | ListOptions
        | ((entity: T) => void | Promise<void>),
      maybeCallback?: (entity: T) => void | Promise<void>
    ): Promise<void> {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback =
        typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },
  }
}

/**
 * Hydrate an entity with lazy-loaded relations
 */
function hydrateEntity(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema
): Record<string, unknown> {
  const hydrated: Record<string, unknown> = { ...data }
  const id = (data.$id || data.id) as string

  // Add lazy getters for relations
  for (const [fieldName, field] of entity.fields) {
    if (field.isRelation && field.relatedType) {
      const relatedEntity = schema.entities.get(field.relatedType)
      if (!relatedEntity) continue

      // Define lazy getter
      Object.defineProperty(hydrated, fieldName, {
        get: async () => {
          const provider = await resolveProvider()

          if (field.isArray) {
            // Array relation - get related entities
            const results = await provider.related(
              entity.name,
              id,
              fieldName
            )
            return Promise.all(
              results.map((r) => hydrateEntity(r, relatedEntity, schema))
            )
          } else {
            // Single relation - get the stored ID and fetch
            const relatedId = data[fieldName] as string | undefined
            if (!relatedId) return null
            const result = await provider.get(field.relatedType!, relatedId)
            return result
              ? hydrateEntity(result, relatedEntity, schema)
              : null
          }
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  return hydrated
}

// =============================================================================
// Re-export for convenience
// =============================================================================

export { parseSchema as parse }
