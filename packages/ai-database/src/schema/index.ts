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
 *
 * @packageDocumentation
 */

import type { MDXLD } from 'mdxld'
import {
  DBPromise,
  wrapEntityOperations,
  setSchemaRelationInfo,
  type ForEachOptions,
  type ForEachResult,
} from '../ai-promise-db.js'

// Re-export types from types.ts
export type {
  ReferenceSpec,
  Draft,
  Resolved,
  DraftOptions,
  ResolveOptions,
  CascadeProgress,
  CreateEntityOptions,
  OperatorParseResult,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  EmbeddingTypeConfig,
  ActorData,
  DBEvent,
  CreateEventOptions,
  DBAction,
  CreateActionOptions,
  DBArtifact,
  EventsAPI,
  ActionsAPI,
  ArtifactsAPI,
  NounsAPI,
  VerbsAPI,
  NLQueryResult,
  NLQueryFn,
  NLQueryContext,
  NLQueryPlan,
  NLQueryGenerator,
  GenerateOptions,
  DBOptions,
} from './types.js'

// Re-export parse functions
export { parseOperator, parseField, parseSchema, isPrimitiveType } from './parse.js'

// Re-export seed functions
export { loadSeedData, fetchSeedData, parseDelimitedData, mapSeedDataToRecords } from './seed.js'
export type { SeedResult as SeedOperationResult } from './seed.js'

// Re-export provider
export type {
  DBProvider,
  DBProviderExtended,
  SemanticSearchResult,
  HybridSearchResult,
} from './provider.js'
export {
  setProvider,
  resolveProvider,
  hasSemanticSearch,
  hasHybridSearch,
  hasEventsAPI,
  hasActionsAPI,
  hasArtifactsAPI,
  hasEmbeddingsConfig,
} from './provider.js'

// Re-export resolve functions
export {
  isEntityId,
  inferTypeFromField,
  resolveContextPath,
  resolveInstructions,
  prefetchContext,
  prefetchContextPaths,
  isPromptField,
  resolveNestedPending,
  resolveReferenceSpec,
  hydrateEntity,
} from './resolve.js'

// Re-export cascade functions
export {
  generateContextAwareValue,
  generateAIFields,
  generateEntity,
  resolveForwardExact,
  generateNaturalLanguageContent,
  // AI generation configuration
  configureAIGeneration,
  getAIGenerationConfig,
  type AIGenerationConfig,
  // Value generator configuration
  setValueGenerator,
  getValueGenerator,
} from './cascade.js'

// Re-export semantic functions
export { resolveBackwardFuzzy, resolveForwardFuzzy } from './semantic.js'

// Re-export NL query generator functions
export { createDefaultNLQueryGenerator, matchesFilter, applyFilters } from './nl-query-generator.js'

// Re-export entity operations
export {
  createEntityOperations,
  createEdgeEntityOperations,
  createNounEntityOperations,
  createVerbEntityOperations,
  type EntityOperations,
  type EntityOperationsConfig,
} from './entity-operations.js'

// Re-export NL query functions
export {
  buildNLQueryContext,
  executeNLQuery,
  createNLQueryFn,
  setNLQueryGenerator,
  getNLQueryGenerator,
} from './nl-query.js'

// Re-export dependency graph functions
export {
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
  PRIMITIVE_TYPES,
  type SchemaDepGraph,
  type SchemaDepNode,
  type SchemaDepEdge,
  type DetectCyclesOptions,
} from './dependency-graph.js'

// Re-export union fallback functions
export {
  parseUnionTypes,
  parseUnionThresholds,
  searchUnionTypes,
  createProviderSearcher,
  type UnionMatch,
  type UnionSearchResult,
  type UnionSearcher,
  type FallbackSearchOptions,
  type SearchError,
} from './union-fallback.js'

// Re-export generation context
export {
  GenerationContext,
  createGenerationContext,
  ContextOverflowError,
  type Entity as GenerationEntity,
  type GenerationContextOptions,
  type ContextSnapshot,
  type FieldContext,
  type BuildContextOptions,
} from './generation-context.js'

// Re-export verb derivation functions
export {
  FORWARD_TO_REVERSE,
  BIDIRECTIONAL_PAIRS,
  deriveReverseVerb,
  fieldNameToVerb,
  isPassiveVerb,
  registerVerbPair,
  registerBidirectionalPair,
  registerFieldVerb,
} from './verb-derivation.js'

// Import for internal use
import type {
  EntitySchema,
  DatabaseSchema,
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  Verb,
  Noun,
  NounProperty,
} from '../types.js'

import type {
  DraftOptions,
  ResolveOptions,
  CreateEntityOptions,
  CascadeState,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  CreateEventOptions,
  CreateActionOptions,
  DBEvent,
  DBAction,
  DBArtifact,
  EventsAPI,
  ActionsAPI,
  ArtifactsAPI,
  NounsAPI,
  VerbsAPI,
  NLQueryResult,
  NLQueryFn,
  NLQueryContext,
  NLQueryPlan,
  NLQueryGenerator,
  GenerateOptions,
  DBOptions,
  ReferenceSpec,
  Draft,
  Resolved,
} from './types.js'

import { Verbs, parseUrl } from '../types.js'
import { inferNoun, getTypeMeta, conjugate } from '../linguistic.js'
import { parseSchema } from './parse.js'
import {
  resolveProvider,
  type DBProvider,
  type SemanticSearchResult,
  type HybridSearchResult,
  hasSemanticSearch,
  hasHybridSearch,
  hasEventsAPI,
  hasActionsAPI,
  hasArtifactsAPI,
  hasEmbeddingsConfig,
} from './provider.js'
import { hydrateEntity, resolveReferenceSpec } from './resolve.js'
import {
  resolveForwardExact,
  generateAIFields,
  generateContextAwareValue,
  generateNaturalLanguageContent,
  generateEntity,
  setValueGenerator,
} from './cascade.js'
import { resolveBackwardFuzzy, resolveForwardFuzzy, getFuzzyThreshold } from './semantic.js'

// Import from extracted modules for use in DB() factory
import {
  createEntityOperations,
  createEdgeEntityOperations,
  createNounEntityOperations,
  createVerbEntityOperations,
  type EntityOperations,
} from './entity-operations.js'
import { createNLQueryFn } from './nl-query.js'

// =============================================================================
// Noun/Verb Helpers
// =============================================================================

/**
 * Create a Noun definition with type inference
 */
export function defineNoun<T extends Noun>(noun: T): T {
  return noun
}

/**
 * Create a Verb definition with type inference
 */
export function defineVerb<T extends Verb>(verb: T): T {
  return verb
}

/**
 * Convert a Noun to an EntitySchema for use with DB()
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
// Built-in Schema Types
// =============================================================================

/**
 * Built-in Thing schema - base type for all entities
 */
export const ThingSchema: EntitySchema = {
  type: 'Noun.things',
}

/**
 * Built-in Noun schema for storing type definitions
 */
export const NounSchema: EntitySchema = {
  name: 'string',
  singular: 'string',
  plural: 'string',
  slug: 'string',
  slugPlural: 'string',
  description: 'string?',
  properties: 'json?',
  relationships: 'json?',
  actions: 'json?',
  events: 'json?',
  metadata: 'json?',
}

/**
 * Built-in Verb schema for storing action definitions
 */
export const VerbSchema: EntitySchema = {
  action: 'string',
  actor: 'string?',
  act: 'string?',
  activity: 'string?',
  result: 'string?',
  reverse: 'json?',
  inverse: 'string?',
  description: 'string?',
}

/**
 * Built-in Edge schema for relationships between types
 */
export const EdgeSchema: EntitySchema = {
  from: 'string',
  name: 'string',
  to: 'string',
  backref: 'string?',
  cardinality: 'string',
  direction: 'string',
  matchMode: 'string?',
  required: 'boolean?',
  description: 'string?',
}

/**
 * System types that are auto-created in every database
 */
export const SystemSchema: DatabaseSchema = {
  Thing: ThingSchema,
  Noun: NounSchema,
  Verb: VerbSchema,
  Edge: EdgeSchema,
}

/**
 * Create Edge records from schema relationships
 */
export function createEdgeRecords(
  typeName: string,
  schema: EntitySchema,
  parsedEntity: ParsedEntity
): Array<Record<string, unknown>> {
  const edges: Array<Record<string, unknown>> = []

  for (const [fieldName, field] of parsedEntity.fields) {
    if (field.isRelation && field.relatedType) {
      const direction = field.direction ?? 'forward'
      const matchMode = field.matchMode ?? 'exact'

      const isBackward = direction === 'backward'
      const from = isBackward ? field.relatedType : typeName
      const to = isBackward ? typeName : field.relatedType

      let cardinality: string
      if (field.isArray) {
        cardinality = field.backref ? 'many-to-many' : 'one-to-many'
      } else {
        cardinality = 'many-to-one'
      }

      edges.push({
        from,
        name: fieldName,
        to,
        backref: field.backref,
        cardinality,
        direction,
        matchMode,
      })
    }
  }

  return edges
}

/**
 * Create a Noun record from a type name and optional schema
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
export type InferEntity<TSchema extends DatabaseSchema, TEntity extends keyof TSchema> = {
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

// Note: EntityOperations interface is now defined in entity-operations.ts
// and re-exported from there

/**
 * Result of a seed operation
 */
export interface SeedResult {
  /** Number of records seeded */
  count: number
}

/**
 * Operations with promise pipelining support
 */
export interface PipelineEntityOperations<T> {
  get(id: string): DBPromise<T | null>
  list(options?: ListOptions): DBPromise<T[]>
  find(where: Partial<T>): DBPromise<T[]>
  search(query: string, options?: SearchOptions): DBPromise<T[]>
  first(): DBPromise<T | null>
  create(data: Omit<T, '$id' | '$type'>, options?: CreateEntityOptions): Promise<T | Draft<T>>
  create(
    id: string,
    data: Omit<T, '$id' | '$type'>,
    options?: CreateEntityOptions
  ): Promise<T | Draft<T>>
  draft(data: Partial<Omit<T, '$id' | '$type'>>, options?: DraftOptions): Promise<Draft<T>>
  resolve(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>>
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>
  delete(id: string): Promise<boolean>
  forEach<U>(
    callback: (entity: T, index: number) => U | Promise<U>,
    options?: ForEachOptions<T>
  ): Promise<ForEachResult>
  semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<T & { $score: number }>>
  hybridSearch(
    query: string,
    options?: HybridSearchOptions
  ): Promise<
    Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
  >
  /** Seed reference data from external URL (only available if $seed is defined) */
  seed?(): Promise<SeedResult>
}

// =============================================================================
// Database Client Type
// =============================================================================

/**
 * Typed database client based on schema
 */
export type TypedDB<TSchema extends DatabaseSchema> = {
  [K in keyof TSchema]: PipelineEntityOperations<InferEntity<TSchema, K>> &
    NLQueryFn<InferEntity<TSchema, K>>
} & {
  readonly $schema: ParsedSchema
  get(url: string): Promise<unknown>
  search(query: string, options?: SearchOptions): Promise<unknown[]>
  count(type: string, where?: Record<string, unknown>): Promise<number>
  forEach(
    options: { type: string; where?: Record<string, unknown>; concurrency?: number },
    callback: (entity: unknown) => void | Promise<void>
  ): Promise<void>
  set(type: string, id: string, data: Record<string, unknown>): Promise<unknown>
  generate(options: GenerateOptions): Promise<unknown | { id: string }>
  ask: NLQueryFn
  semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<{ $id: string; $type: string; $score: number; [key: string]: unknown }>>
  on(event: string, handler: (data: unknown) => void): () => void
}

/**
 * Result of DB() factory
 */
export type DBResult<TSchema extends DatabaseSchema> = TypedDB<TSchema> & {
  db: TypedDB<TSchema>
  events: EventsAPI
  actions: ActionsAPI
  artifacts: ArtifactsAPI
  nouns: NounsAPI
  verbs: VerbsAPI
}

// Note: NL Query functions extracted to nl-query.ts

// Note: Edge Entity Operations extracted to entity-operations.ts

// =============================================================================
// DB Factory
// =============================================================================

/**
 * Create a typed database from a schema definition
 */
export function DB<TSchema extends DatabaseSchema>(
  schema: TSchema,
  options?: DBOptions
): DBResult<TSchema> {
  const parsedSchema = parseSchema(schema)

  // Add system entities to the parsed schema (Noun, Verb, Edge)

  // Noun entity - represents type definitions
  const nounEntity: ParsedEntity = {
    name: 'Noun',
    fields: new Map([
      [
        'name',
        { name: 'name', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'singular',
        { name: 'singular', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'plural',
        { name: 'plural', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'slug',
        { name: 'slug', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'slugPlural',
        {
          name: 'slugPlural',
          type: 'string',
          isArray: false,
          isOptional: false,
          isRelation: false,
        },
      ],
      [
        'description',
        {
          name: 'description',
          type: 'string',
          isArray: false,
          isOptional: true,
          isRelation: false,
        },
      ],
      [
        'properties',
        { name: 'properties', type: 'json', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'relationships',
        {
          name: 'relationships',
          type: 'json',
          isArray: false,
          isOptional: true,
          isRelation: false,
        },
      ],
      [
        'actions',
        { name: 'actions', type: 'json', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'events',
        { name: 'events', type: 'json', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'metadata',
        { name: 'metadata', type: 'json', isArray: false, isOptional: true, isRelation: false },
      ],
    ]),
  }
  parsedSchema.entities.set('Noun', nounEntity)

  // Verb entity - represents action definitions
  const verbEntity: ParsedEntity = {
    name: 'Verb',
    fields: new Map([
      [
        'action',
        { name: 'action', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'actor',
        { name: 'actor', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
      ['act', { name: 'act', type: 'string', isArray: false, isOptional: true, isRelation: false }],
      [
        'activity',
        { name: 'activity', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'result',
        { name: 'result', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'reverse',
        { name: 'reverse', type: 'json', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'inverse',
        { name: 'inverse', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'description',
        {
          name: 'description',
          type: 'string',
          isArray: false,
          isOptional: true,
          isRelation: false,
        },
      ],
    ]),
  }
  parsedSchema.entities.set('Verb', verbEntity)

  // Edge entity - represents relationships
  const edgeEntity: ParsedEntity = {
    name: 'Edge',
    fields: new Map([
      [
        'from',
        { name: 'from', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'name',
        { name: 'name', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      ['to', { name: 'to', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      [
        'backref',
        { name: 'backref', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
      [
        'cardinality',
        {
          name: 'cardinality',
          type: 'string',
          isArray: false,
          isOptional: false,
          isRelation: false,
        },
      ],
      [
        'direction',
        { name: 'direction', type: 'string', isArray: false, isOptional: false, isRelation: false },
      ],
      [
        'matchMode',
        { name: 'matchMode', type: 'string', isArray: false, isOptional: true, isRelation: false },
      ],
    ]),
  }
  parsedSchema.entities.set('Edge', edgeEntity)

  // Configure value generator if provided
  if (options?.valueGenerator) {
    setValueGenerator(options.valueGenerator)
  }

  // Configure provider with embeddings settings if provided
  if (options?.embeddings) {
    resolveProvider().then((provider) => {
      if (hasEmbeddingsConfig(provider)) {
        provider.setEmbeddingsConfig(options.embeddings!)
      }
    })
  }

  // Collect all edge records from the schema
  const allEdgeRecords: Array<Record<string, unknown>> = []
  for (const [entityName, entity] of parsedSchema.entities) {
    // Only create edge records for user-defined entities (not system entities)
    if (entityName !== 'Edge' && entityName !== 'Noun' && entityName !== 'Verb') {
      const edgeRecords = createEdgeRecords(entityName, schema[entityName] ?? {}, entity)
      allEdgeRecords.push(...edgeRecords)
    }
  }

  // Collect all noun records from the schema (user-defined entities only)
  const allNounRecords: Array<Record<string, unknown>> = []
  for (const [entityName, entity] of parsedSchema.entities) {
    // Only create noun records for user-defined entities (not system entities)
    if (entityName !== 'Edge' && entityName !== 'Noun' && entityName !== 'Verb') {
      const nounRecord = createNounRecord(entityName, schema[entityName])
      allNounRecords.push(nounRecord)
    }
  }

  // Collect all verb records from the standard verbs
  const allVerbRecords: Array<Record<string, unknown>> = Object.values(Verbs).map((verb) => ({
    ...verb,
    $id: verb.action,
    $type: 'Verb',
  }))

  // Build and set schema relation info for batch loading
  // Maps entityType -> fieldName -> relatedType
  const relationInfo = new Map<string, Map<string, string>>()
  for (const [entityName, entity] of parsedSchema.entities) {
    const fieldRelations = new Map<string, string>()
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType) {
        fieldRelations.set(fieldName, field.relatedType)
      }
    }
    if (fieldRelations.size > 0) {
      relationInfo.set(entityName, fieldRelations)
    }
  }
  setSchemaRelationInfo(relationInfo)

  // Create Actions API early for internal use by wrapEntityOperations
  // This API adapts DBAction to ForEachActionsAPI interface
  const actionsAPI: import('../ai-promise-db.js').ForEachActionsAPI = {
    async create(data: { type: string; data: unknown; total?: number }) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        const action = await provider.createAction(data)
        return { id: action.id }
      }
      throw new Error('Provider does not support actions')
    },
    async get(id: string): Promise<import('../ai-promise-db.js').ForEachActionState | null> {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        const action = await provider.getAction(id)
        if (!action) return null
        // Adapt DBAction to ForEachActionState
        const state: import('../ai-promise-db.js').ForEachActionState = {
          id: action.id,
          type: action.action ?? action.type ?? 'unknown',
          status: action.status,
          data: action.objectData ?? {},
        }
        if (action.progress !== undefined) state.progress = action.progress
        if (action.total !== undefined) state.total = action.total
        if (action.result !== undefined)
          state.result = action.result as unknown as import('../ai-promise-db.js').ForEachResult
        if (action.error !== undefined) state.error = action.error
        return state
      }
      return null
    },
    async update(id: string, updates: Partial<import('../ai-promise-db.js').ForEachActionState>) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        const updatePayload: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>> =
          {}
        if (updates.status !== undefined) updatePayload.status = updates.status
        if (updates.progress !== undefined) updatePayload.progress = updates.progress
        if (updates.error !== undefined) updatePayload.error = updates.error
        // ForEachResult needs to be converted to Record<string, unknown> for DBAction.result
        if (updates.result !== undefined) {
          updatePayload.result = updates.result as unknown as Record<string, unknown>
        }
        await provider.updateAction(id, updatePayload)
        return
      }
      throw new Error('Provider does not support actions')
    },
  }

  // Create entity operations
  // Using Record<string, unknown> with [key: string]: unknown allows flexible method access
  // while being safer than `any`. The actual operations implement EntityOperations<T>
  // but we lose the generic when storing by entity name.
  //
  // IMPORTANT: Each entity must be both:
  // 1. Callable as a tagged template literal: db.Lead`query`
  // 2. An object with methods: db.Lead.get(), db.Lead.list(), etc.
  //
  // We achieve this by creating a function and attaching methods to it.
  const entityOperations: Record<string, Record<string, unknown>> = {}
  const eventHandlersForOps = new Map<string, Set<(data: unknown) => void>>()

  function emitInternalEventForOps(eventType: string, data: unknown): void {
    const handlers = eventHandlersForOps.get(eventType)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (e) {
          console.error(`Error in event handler for ${eventType}:`, e)
        }
      }
    }
  }

  /**
   * Make entity operations callable as a tagged template literal
   * This allows both: db.Lead.get('id') and db.Lead`natural language query`
   */
  function makeCallableEntityOps(
    ops: Record<string, unknown>,
    entityName: string
  ): Record<string, unknown> {
    // Create the NL query function for this entity type
    const nlQueryFn = createNLQueryFn(parsedSchema, entityName)

    // Create a function that acts as the tagged template literal handler
    const callableOps = function (strings: TemplateStringsArray, ...values: unknown[]) {
      return nlQueryFn(strings, ...values)
    }

    // Copy all methods from the wrapped operations to the function
    Object.assign(callableOps, ops)

    return callableOps as unknown as Record<string, unknown>
  }

  for (const [entityName, entity] of parsedSchema.entities) {
    if (entityName === 'Edge') {
      // Edge entity - auto-generated from schema relationships
      const edgeOps = createEdgeEntityOperations(allEdgeRecords, resolveProvider)
      const wrappedEdgeOps = wrapEntityOperations(entityName, edgeOps, actionsAPI) as Record<
        string,
        unknown
      >
      entityOperations[entityName] = makeCallableEntityOps(wrappedEdgeOps, entityName)
    } else if (entityName === 'Noun') {
      // Noun entity - auto-generated from schema entity types
      const nounOps = createNounEntityOperations(allNounRecords)
      const wrappedNounOps = wrapEntityOperations(entityName, nounOps, actionsAPI) as Record<
        string,
        unknown
      >
      entityOperations[entityName] = makeCallableEntityOps(wrappedNounOps, entityName)
    } else if (entityName === 'Verb') {
      // Verb entity - standard verbs with conjugation forms
      const verbOps = createVerbEntityOperations(allVerbRecords)
      const wrappedVerbOps = wrapEntityOperations(entityName, verbOps, actionsAPI) as Record<
        string,
        unknown
      >
      entityOperations[entityName] = makeCallableEntityOps(wrappedVerbOps, entityName)
    } else {
      const baseOps = createEntityOperations(entityName, entity, parsedSchema)
      const wrappedOps = wrapEntityOperations(entityName, baseOps, actionsAPI)

      // baseOps has optional draft/resolve methods - EntityOperations<T> defines them as optional
      const draftMethod = baseOps.draft
      const resolveMethod = baseOps.resolve

      const draftFn = async (
        data: Record<string, unknown>,
        options?: DraftOptions
      ): Promise<unknown> => {
        if (!draftMethod) {
          throw new Error(`Draft method not available for ${entityName}`)
        }
        const draft = await draftMethod(data as Partial<Record<string, unknown>>, options)
        ;(draft as Record<string, unknown>)['$type'] = entityName
        emitInternalEventForOps('draft', draft)
        return draft
      }
      wrappedOps.draft = draftFn

      const resolveFn = async (draft: unknown, options?: ResolveOptions): Promise<unknown> => {
        if (!resolveMethod) {
          throw new Error(`Resolve method not available for ${entityName}`)
        }
        const resolved = await resolveMethod(draft as Draft<Record<string, unknown>>, options)
        if (resolved && typeof resolved === 'object') {
          ;(resolved as Record<string, unknown>)['$type'] = entityName
        }
        emitInternalEventForOps('resolve', resolved)
        return resolved
      }
      wrappedOps.resolve = resolveFn

      const originalCreate = wrappedOps.create
      wrappedOps.create = async (...args: unknown[]): Promise<unknown> => {
        console.log('[schema/index.ts wrappedOps.create] CALLED for', entityName, 'args:', args)
        let id: string | undefined
        let data: Record<string, unknown>
        let options: CreateEntityOptions | undefined

        if (typeof args[0] === 'string') {
          id = args[0]
          data = args[1] as Record<string, unknown>
          options = args[2] as CreateEntityOptions | undefined
        } else {
          data = args[0] as Record<string, unknown>
          options = args[1] as CreateEntityOptions | undefined
        }

        if (options?.draftOnly) {
          const draft = await draftFn(data)
          return draft
        }

        // Check if entity has reference fields that need two-phase processing
        const entityDef = parsedSchema.entities.get(entityName)
        const effectiveMaxDepth = options?.maxDepth ?? (options?.cascade ? 3 : 0)
        // Disable auto-generation when:
        // 1. cascade is explicitly set to false
        // 2. cascade is true but maxDepth is 0 (depth exhausted)
        // When cascade is undefined, single-level array generation is allowed
        const cascadeExplicitlyDisabled =
          options?.cascade === false || (options?.cascade === true && effectiveMaxDepth === 0)

        const hasReferenceFields =
          entityDef &&
          Array.from(entityDef.fields.values()).some((field) => {
            if (!field.operator || !field.relatedType) return false
            // Exclude forward fuzzy (~>) - handled by resolveForwardFuzzy in the direct create path
            if (field.operator === '~>') return false
            // For forward exact (->) array fields when cascade is explicitly disabled
            if (field.operator === '->' && field.isArray && cascadeExplicitlyDisabled) {
              return false
            }
            return true
          })
        console.log('[schema/index.ts] hasReferenceFields:', hasReferenceFields, 'for', entityName)

        // Cascade takes priority over two-phase processing when enabled
        // Cascade handles generating related entities through the graph
        if (options?.cascade && effectiveMaxDepth > 0) {
          const provider = await resolveProvider()
          const entityDef = parsedSchema.entities.get(entityName)
          if (entityDef) {
            // CreateEntityOptions now includes _cascadeState as an optional property
            const cascadeState: CascadeState = options._cascadeState ?? {
              totalEntitiesCreated: 0,
              initialMaxDepth: effectiveMaxDepth,
              ...(options.onProgress !== undefined && { rootOnProgress: options.onProgress }),
              ...(options.onError !== undefined && { rootOnError: options.onError }),
              ...(options.stopOnError !== undefined && { stopOnError: options.stopOnError }),
              ...(options.cascadeTypes !== undefined && { cascadeTypes: options.cascadeTypes }),
            }
            const currentDepth = cascadeState.initialMaxDepth - effectiveMaxDepth
            const cascadeData = { ...data }

            // Emit progress for current entity being generated
            cascadeState.rootOnProgress?.({
              phase: 'generating',
              depth: currentDepth,
              currentType: entityName,
              totalEntitiesCreated: cascadeState.totalEntitiesCreated,
            })

            for (const [fieldName, field] of entityDef.fields) {
              if (cascadeData[fieldName] !== undefined) continue
              if (field.operator === '->' && field.relatedType) {
                if (
                  cascadeState.cascadeTypes &&
                  !cascadeState.cascadeTypes.includes(field.relatedType)
                ) {
                  continue
                }

                const relatedEntity = parsedSchema.entities.get(field.relatedType)
                if (!relatedEntity) continue

                try {
                  cascadeState.rootOnProgress?.({
                    phase: 'generating',
                    depth: currentDepth + 1,
                    currentType: field.relatedType,
                    totalEntitiesCreated: cascadeState.totalEntitiesCreated,
                  })

                  const childEntityData: Record<string, unknown> = {}
                  const parentInstructions = entityDef.schema?.['$instructions'] as
                    | string
                    | undefined
                  const childInstructions = relatedEntity.schema?.['$instructions'] as
                    | string
                    | undefined

                  const contextParts: string[] = []
                  if (parentInstructions) contextParts.push(parentInstructions)
                  if (childInstructions) contextParts.push(childInstructions)

                  for (const [key, value] of Object.entries(cascadeData)) {
                    if (
                      !key.startsWith('$') &&
                      !key.startsWith('_') &&
                      typeof value === 'string' &&
                      value
                    ) {
                      contextParts.push(`${key}: ${value}`)
                    }
                  }

                  const fullContext = contextParts.join(' | ')

                  for (const [childFieldName, childField] of relatedEntity.fields) {
                    // Check if it's a prompt field (type contains spaces, slashes, or question marks)
                    const isPromptField =
                      childField.type.includes(' ') ||
                      childField.type.includes('/') ||
                      childField.type.includes('?')

                    if (!childField.isRelation && (childField.type === 'string' || isPromptField)) {
                      // Use field type as hint for prompt fields
                      const fieldHint = isPromptField ? childField.type : undefined
                      childEntityData[childFieldName] = generateContextAwareValue(
                        childFieldName,
                        field.relatedType,
                        fullContext,
                        fieldHint,
                        cascadeData
                      )
                    }
                  }

                  const childOptions: CreateEntityOptions = {
                    ...options,
                    cascade: true, // Ensure cascade continues for child entities
                    maxDepth: effectiveMaxDepth - 1,
                    _cascadeState: cascadeState,
                  }
                  const relatedOps = entityOperations[field.relatedType]
                  const createFn = relatedOps?.['create'] as
                    | ((
                        data: Record<string, unknown>,
                        opts?: CreateEntityOptions
                      ) => Promise<Record<string, unknown>>)
                    | undefined
                  const childEntity = createFn
                    ? await createFn(childEntityData, childOptions)
                    : undefined

                  if (childEntity?.['$id']) {
                    cascadeState.totalEntitiesCreated++
                    if (field.isArray) {
                      cascadeData[fieldName] = [childEntity['$id']]
                    } else {
                      cascadeData[fieldName] = childEntity['$id']
                    }
                  }
                } catch (error) {
                  cascadeState.rootOnError?.(error as Error)
                  if (cascadeState.stopOnError) {
                    throw error
                  }
                }
              }
            }

            // Use type assertion for internal overload dispatch via .call()
            type CreateFn = (...args: unknown[]) => Promise<unknown>
            const createFn = originalCreate as CreateFn
            let result
            if (id) {
              result = await createFn.call(wrappedOps, id, cascadeData)
            } else {
              result = await createFn.call(wrappedOps, cascadeData)
            }

            cascadeState.totalEntitiesCreated++

            if (currentDepth === 0) {
              cascadeState.rootOnProgress?.({
                phase: 'complete',
                depth: currentDepth,
                totalEntitiesCreated: cascadeState.totalEntitiesCreated,
              })
            }

            return result
          }
        }

        // Use two-phase draft/resolve pipeline when entity has reference fields (but cascade not enabled)
        if (hasReferenceFields) {
          // Phase 1: Draft - create placeholder with natural language refs
          // Skip promptless refs when cascade is not explicitly enabled (default behavior = no auto-generation)
          const skipPromptless = options?.cascade !== true
          const draft = await draftFn(data, { _skipPromptlessRefs: skipPromptless })

          // Phase 2: Resolve - convert refs to actual entity IDs
          const resolved = await resolveFn(draft)

          // Extract clean data for persistence (remove $phase, $refs, $errors)
          const { $phase, $refs, $errors, $type, ...cleanData } = resolved as Record<
            string,
            unknown
          >

          // Phase 3: Generate AI fields for entities with $context dependencies
          // The draft phase skips prompt fields for entities with $context because
          // those fields need pre-fetched context data to generate properly.
          // generateAIFields handles this context pre-fetching and field generation.
          console.log('[schema/index.ts] Two-phase path - calling generateAIFields for', entityName)
          const provider = await resolveProvider()
          const entityDefForAI = parsedSchema.entities.get(entityName)
          let finalCleanData = cleanData
          console.log('[schema/index.ts] entityDefForAI:', entityDefForAI?.name)
          if (entityDefForAI) {
            console.log('[schema/index.ts] Calling generateAIFields with cleanData:', cleanData)
            finalCleanData = await generateAIFields(
              cleanData,
              entityName,
              entityDefForAI,
              parsedSchema,
              provider
            )
            console.log('[schema/index.ts] finalCleanData after generateAIFields:', finalCleanData)
          }

          // Persist the resolved entity - use type assertion for internal overload dispatch
          type CreateFn = (...args: unknown[]) => Promise<unknown>
          const createFn = originalCreate as CreateFn
          let result
          if (id) {
            result = await createFn.call(wrappedOps, id, finalCleanData)
          } else {
            result = await createFn.call(wrappedOps, finalCleanData)
          }

          return result
        }

        // Pre-initialize empty arrays for ->Type[] fields when cascade is explicitly disabled
        // This prevents resolveForwardExact from auto-generating entities for array fields
        let processedData = data
        if (cascadeExplicitlyDisabled && entityDef) {
          processedData = { ...data }
          for (const [fieldName, field] of entityDef.fields) {
            if (processedData[fieldName] !== undefined) continue
            if (field.isArray && field.operator === '->' && field.relatedType) {
              processedData[fieldName] = []
            }
          }
        }

        // Call with properly typed arguments (already extracted above)
        // Use type assertion for internal overload dispatch via .call()
        const createFnFinal = originalCreate as (...args: unknown[]) => Promise<unknown>
        if (id) {
          return createFnFinal.call(wrappedOps, id, processedData, options)
        }
        return createFnFinal.call(wrappedOps, processedData, options)
      }

      // Add seed method if entity has seed configuration
      if (entity.seedConfig) {
        const seedConfig = entity.seedConfig
        ;(wrappedOps as Record<string, unknown>)['seed'] = async (): Promise<{ count: number }> => {
          const { loadSeedData } = await import('./seed.js')
          const records = await loadSeedData(seedConfig)
          const provider = await resolveProvider()

          for (const record of records) {
            const { $id, ...data } = record
            // Upsert: check if exists, then update or create
            const existing = await provider.get(entityName, $id)
            if (existing) {
              await provider.update(entityName, $id, data as Record<string, unknown>)
            } else {
              await provider.create(entityName, $id, data as Record<string, unknown>)
            }
          }

          return { count: records.length }
        }
      }

      // Make the entity operations callable as a tagged template literal
      entityOperations[entityName] = makeCallableEntityOps(
        wrappedOps as Record<string, unknown>,
        entityName
      )
    }
  }

  // Noun definitions cache
  const nounDefinitions = new Map<string, Noun>()
  for (const [entityName] of parsedSchema.entities) {
    const noun = inferNoun(entityName)
    nounDefinitions.set(entityName, noun)
  }

  // Verb definitions cache
  const verbDefinitions = new Map<string, Verb>(Object.entries(Verbs).map(([k, v]) => [k, v]))

  function onInternal(eventType: string, handler: (data: unknown) => void): () => void {
    if (!eventHandlersForOps.has(eventType)) {
      eventHandlersForOps.set(eventType, new Set())
    }
    eventHandlersForOps.get(eventType)!.add(handler)
    return () => {
      eventHandlersForOps.get(eventType)?.delete(handler)
    }
  }

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

    async semanticSearch(query: string, options?: SemanticSearchOptions) {
      const provider = await resolveProvider()
      const results: Array<{ $id: string; $type: string; $score: number; [key: string]: unknown }> =
        []

      if (hasSemanticSearch(provider)) {
        for (const [typeName] of parsedSchema.entities) {
          const typeResults: SemanticSearchResult[] = await provider.semanticSearch(
            typeName,
            query,
            options
          )
          results.push(...typeResults)
        }
      }

      results.sort((a, b) => b.$score - a.$score)
      const limit = options?.limit ?? results.length
      return results.slice(0, limit)
    },

    async count(type: string, where?: Record<string, unknown>) {
      const provider = await resolveProvider()
      const listOpts: ListOptions = {}
      if (where !== undefined) listOpts.where = where
      const results = await provider.list(type, listOpts)
      return results.length
    },

    async forEach(
      options: { type: string; where?: Record<string, unknown>; concurrency?: number },
      callback: (entity: unknown) => void | Promise<void>
    ) {
      const provider = await resolveProvider()
      const listOpts: ListOptions = {}
      if (options.where !== undefined) listOpts.where = options.where
      const results = await provider.list(options.type, listOpts)
      const concurrency = options.concurrency ?? 1

      if (concurrency === 1) {
        for (const entity of results) {
          await callback(entity)
        }
      } else {
        const { Semaphore } = await import('../memory-provider.js')
        const semaphore = new Semaphore(concurrency)
        await semaphore.map(results, callback as (item: Record<string, unknown>) => Promise<void>)
      }
    },

    async set(type: string, id: string, data: Record<string, unknown>) {
      const provider = await resolveProvider()
      const existing = await provider.get(type, id)
      if (existing) {
        return provider.update(type, id, data)
      }
      return provider.create(type, id, data)
    },

    async generate(options: GenerateOptions) {
      const provider = await resolveProvider()
      if (options.mode === 'background') {
        const { createMemoryProvider } = await import('../memory-provider.js')
        const memProvider = provider as ReturnType<typeof createMemoryProvider>
        if ('createAction' in memProvider) {
          return memProvider.createAction({
            type: 'generate',
            data: options,
            total: options.count ?? 1,
          })
        }
      }
      return provider.create(options.type, undefined, options.data ?? {})
    },

    ask: createNLQueryFn(parsedSchema),
    on: onInternal,
    ...entityOperations,
  } as TypedDB<TSchema>

  // Create Events API
  const events: EventsAPI = {
    on(pattern, handler) {
      let unsubscribe = () => {}
      resolveProvider().then((provider) => {
        if (hasEventsAPI(provider)) {
          unsubscribe = provider.on(pattern, handler)
        }
      })
      return () => unsubscribe()
    },

    async emit(optionsOrType: CreateEventOptions | string, data?: unknown): Promise<DBEvent> {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        // The provider.emit has overloads: (options: CreateEventOptions) or (type: string, data: unknown)
        if (typeof optionsOrType === 'string') {
          return provider.emit(optionsOrType, data)
        }
        return provider.emit(optionsOrType)
      }
      const now = new Date()
      if (typeof optionsOrType === 'string') {
        const baseEvent: DBEvent = {
          id: crypto.randomUUID(),
          actor: 'system',
          event: optionsOrType,
          timestamp: now,
        }
        if (data !== undefined) baseEvent.objectData = data as Record<string, unknown>
        return baseEvent
      }
      const baseEvent: DBEvent = {
        id: crypto.randomUUID(),
        actor: optionsOrType.actor,
        event: optionsOrType.event,
        timestamp: now,
      }
      if (optionsOrType.actorData !== undefined) baseEvent.actorData = optionsOrType.actorData
      if (optionsOrType.object !== undefined) baseEvent.object = optionsOrType.object
      if (optionsOrType.objectData !== undefined) baseEvent.objectData = optionsOrType.objectData
      if (optionsOrType.result !== undefined) baseEvent.result = optionsOrType.result
      if (optionsOrType.resultData !== undefined) baseEvent.resultData = optionsOrType.resultData
      if (optionsOrType.meta !== undefined) baseEvent.meta = optionsOrType.meta
      return baseEvent
    },

    async list(options) {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        return provider.listEvents(options)
      }
      return []
    },

    async replay(options) {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        await provider.replayEvents(options)
      }
    },
  }

  // Create Actions API (public version with full DBAction types)
  const actions: ActionsAPI = {
    async create(options: CreateActionOptions | { type: string; data: unknown; total?: number }) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.createAction(options)
      }
      throw new Error('Provider does not support actions')
    },

    async get(id: string) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.getAction(id)
      }
      return null
    },

    async update(
      id: string,
      updates: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>>
    ) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.updateAction(id, updates)
      }
      throw new Error('Provider does not support actions')
    },

    async list(options) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.listActions(options)
      }
      return []
    },

    async retry(id) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.retryAction(id)
      }
      throw new Error('Provider does not support actions')
    },

    async cancel(id) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        await provider.cancelAction(id)
      }
    },

    conjugate,
  }

  // Create Artifacts API
  const artifacts: ArtifactsAPI = {
    async get(url, type) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        return provider.getArtifact(url, type)
      }
      return null
    },

    async set(url, type, data) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        await provider.setArtifact(url, type, data)
      }
    },

    async delete(url, type) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        await provider.deleteArtifact(url, type)
      }
    },

    async list(url) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        return provider.listArtifacts(url)
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

  return Object.assign(db, {
    db,
    events,
    actions,
    artifacts,
    nouns,
    verbs,
  }) as DBResult<TSchema>
}
