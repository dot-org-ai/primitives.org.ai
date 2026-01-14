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
} from './cascade.js'

// Re-export semantic functions
export { resolveBackwardFuzzy, resolveForwardFuzzy } from './semantic.js'

// Re-export NL query generator functions
export { createDefaultNLQueryGenerator, matchesFilter, applyFilters } from './nl-query-generator.js'

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
} from './cascade.js'
import { resolveBackwardFuzzy, resolveForwardFuzzy, getFuzzyThreshold } from './semantic.js'

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

/**
 * Operations available on each entity type
 */
export interface EntityOperations<T> {
  get(id: string): Promise<T | null>
  list(options?: ListOptions): Promise<T[]>
  find(where: Partial<T>): Promise<T[]>
  search(query: string, options?: SearchOptions): Promise<T[]>
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>
  delete(id: string): Promise<boolean>
  forEach(callback: (entity: T) => void | Promise<void>): Promise<void>
  forEach(options: ListOptions, callback: (entity: T) => void | Promise<void>): Promise<void>
  semanticSearch?(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<T & { $score: number }>>
  hybridSearch?(
    query: string,
    options?: HybridSearchOptions
  ): Promise<
    Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
  >
  draft?(data: Partial<Omit<T, '$id' | '$type'>>, options?: DraftOptions): Promise<Draft<T>>
  resolve?(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>>
}

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

// =============================================================================
// Natural Language Query Implementation
// =============================================================================

let nlQueryGenerator: NLQueryGenerator | null = null

/**
 * Set the AI generator for natural language queries
 */
export function setNLQueryGenerator(generator: NLQueryGenerator): void {
  nlQueryGenerator = generator
}

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

async function executeNLQuery<T>(
  question: string,
  schema: ParsedSchema,
  targetType?: string
): Promise<NLQueryResult<T>> {
  // Import applyFilters for MongoDB-style filter support
  const { applyFilters } = await import('./nl-query-generator.js')

  if (!nlQueryGenerator) {
    const provider = await resolveProvider()
    const results: T[] = []

    // Simple heuristic for common "list all" patterns in fallback mode
    const lowerQuestion = question.toLowerCase().trim()
    const isListAllQuery =
      /^(show|list|get|find|display)\s+(all|every|the)?\s*/i.test(lowerQuestion) ||
      lowerQuestion === '' ||
      /\ball\b/i.test(lowerQuestion)

    if (targetType) {
      if (isListAllQuery) {
        // For "show all X" queries, just list everything
        const listResults = await provider.list(targetType)
        results.push(...(listResults as T[]))
      } else {
        const searchResults = await provider.search(targetType, question)
        results.push(...(searchResults as T[]))
      }
    } else {
      for (const [typeName] of schema.entities) {
        if (isListAllQuery) {
          const listResults = await provider.list(typeName)
          results.push(...(listResults as T[]))
        } else {
          const searchResults = await provider.search(typeName, question)
          results.push(...(searchResults as T[]))
        }
      }
    }

    return {
      interpretation: `Search for "${question}"`,
      confidence: 0.5,
      results,
      explanation: 'Fallback to keyword search (no AI generator configured)',
    }
  }

  const context = buildNLQueryContext(schema, targetType)
  const plan = await nlQueryGenerator(question, context)

  const provider = await resolveProvider()
  let results: T[] = []

  for (const typeName of plan.types) {
    let typeResults: Record<string, unknown>[]

    if (plan.search) {
      // Use provider's search, then apply filters in memory for MongoDB-style operators
      typeResults = await provider.search(typeName, plan.search)
    } else {
      // List all and filter in memory
      typeResults = await provider.list(typeName)
    }

    // Apply MongoDB-style filters in memory
    if (plan.filters && Object.keys(plan.filters).length > 0) {
      typeResults = applyFilters(typeResults, plan.filters)
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

function createNLQueryFn<T>(schema: ParsedSchema, typeName?: string): NLQueryFn<T> {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const question = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? String(values[i]) : '')
    }, '')

    return executeNLQuery<T>(question, schema, typeName)
  }
}

// =============================================================================
// Edge Entity Operations
// =============================================================================

function createEdgeEntityOperations(
  schemaEdgeRecords: Array<Record<string, unknown>>,
  getProvider: () => Promise<DBProvider>
): EntityOperations<Record<string, unknown>> {
  async function getRuntimeEdges(): Promise<Array<Record<string, unknown>>> {
    try {
      const provider = await getProvider()
      const runtimeEdges = await provider.list('Edge')
      return runtimeEdges
    } catch {
      return []
    }
  }

  async function getAllEdges(): Promise<Array<Record<string, unknown>>> {
    const runtimeEdges = await getRuntimeEdges()
    const runtimeEdgeKeys = new Set(runtimeEdges.map((e) => `${e.from}:${e.name}`))

    const filteredSchemaEdges = schemaEdgeRecords.filter((e) => {
      const key = `${e.from}:${e.name}`
      const hasRuntimeVersion = runtimeEdgeKeys.has(key)
      if (hasRuntimeVersion && e.matchMode === 'fuzzy') {
        return false
      }
      return !hasRuntimeVersion
    })

    return [...filteredSchemaEdges, ...runtimeEdges]
  }

  return {
    async get(id: string) {
      const runtimeEdges = await getRuntimeEdges()
      const runtimeMatch = runtimeEdges.find((e) => e.$id === id || `${e.from}:${e.name}` === id)
      if (runtimeMatch) return { ...runtimeMatch, $type: 'Edge' }
      return schemaEdgeRecords.find((e) => `${e.from}:${e.name}` === id) ?? null
    },

    async list(options?: ListOptions) {
      let results = await getAllEdges()
      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          results = results.filter((e) => e[key] === value)
        }
      }
      return results.map((e) => ({
        ...e,
        $id: e.$id || `${e.from}:${e.name}`,
        $type: 'Edge',
      }))
    },

    async find(where: Record<string, unknown>) {
      let results = await getAllEdges()
      for (const [key, value] of Object.entries(where)) {
        results = results.filter((e) => e[key] === value)
      }
      return results.map((e) => ({
        ...e,
        $id: e.$id || `${e.from}:${e.name}`,
        $type: 'Edge',
      }))
    },

    async search(query: string) {
      const allEdges = await getAllEdges()
      const queryLower = query.toLowerCase()
      return allEdges
        .filter(
          (e) =>
            String(e.from).toLowerCase().includes(queryLower) ||
            String(e.name).toLowerCase().includes(queryLower) ||
            String(e.to).toLowerCase().includes(queryLower)
        )
        .map((e) => ({
          ...e,
          $id: e.$id || `${e.from}:${e.name}`,
          $type: 'Edge',
        }))
    },

    async create() {
      throw new Error('Cannot manually create Edge records - they are auto-generated')
    },

    async update() {
      throw new Error('Cannot manually update Edge records - they are auto-generated')
    },

    async upsert() {
      throw new Error('Cannot manually upsert Edge records - they are auto-generated')
    },

    async delete() {
      throw new Error('Cannot manually delete Edge records - they are auto-generated')
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: Record<string, unknown>) => void | Promise<void>),
      maybeCallback?: (entity: Record<string, unknown>) => void | Promise<void>
    ) {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!
      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch() {
      return []
    },

    async hybridSearch() {
      return []
    },
  }
}

// =============================================================================
// Entity Operations Factory
// =============================================================================

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
      return hydrateEntity(result, entity, schema, resolveProvider) as T
    },

    async list(options?: ListOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, options)
      return Promise.all(results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T))
    },

    async find(where: Partial<T>): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, {
        where: where as Record<string, unknown>,
      })
      return Promise.all(results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T))
    },

    async search(query: string, options?: SearchOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.search(typeName, query, options)
      return Promise.all(results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T))
    },

    async create(
      idOrData: string | Omit<T, '$id' | '$type'>,
      maybeData?: Omit<T, '$id' | '$type'>
    ): Promise<T> {
      const provider = await resolveProvider()
      const providedId = typeof idOrData === 'string' ? idOrData : undefined
      const data =
        typeof idOrData === 'string'
          ? (maybeData as Record<string, unknown>)
          : (idOrData as Record<string, unknown>)

      const entityId = providedId || crypto.randomUUID()

      const { data: resolvedData, pendingRelations } = await resolveForwardExact(
        typeName,
        data,
        entity,
        schema,
        provider,
        entityId
      )

      const { data: fuzzyResolvedData, pendingRelations: fuzzyPendingRelations } =
        await resolveForwardFuzzy(typeName, resolvedData, entity, schema, provider, entityId)

      const backwardResolvedData = await resolveBackwardFuzzy(
        typeName,
        fuzzyResolvedData,
        entity,
        schema,
        provider
      )

      const finalData = await generateAIFields(
        backwardResolvedData,
        typeName,
        entity,
        schema,
        provider
      )

      const result = await provider.create(typeName, entityId, finalData)

      for (const rel of pendingRelations) {
        await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId)
      }

      const createdEdgeIds = new Set<string>()
      for (const rel of fuzzyPendingRelations) {
        await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId, {
          matchMode: 'fuzzy',
          similarity: rel.similarity,
          matchedType: rel.matchedType,
        })

        const edgeId = `${typeName}:${rel.fieldName}:${entityId}:${rel.targetId}`
        if (!createdEdgeIds.has(edgeId)) {
          createdEdgeIds.add(edgeId)
          try {
            await provider.create('Edge', edgeId, {
              from: typeName,
              name: rel.fieldName,
              to: rel.targetType,
              direction: 'forward',
              matchMode: 'fuzzy',
              similarity: rel.similarity,
              matchedType: rel.matchedType,
              fromId: entityId,
              toId: rel.targetId,
            })
          } catch {
            // Edge already exists
          }
        }
      }

      return hydrateEntity(result, entity, schema, resolveProvider) as T
    },

    async update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T> {
      const provider = await resolveProvider()
      const result = await provider.update(typeName, id, data as Record<string, unknown>)
      return hydrateEntity(result, entity, schema, resolveProvider) as T
    },

    async upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T> {
      const provider = await resolveProvider()
      const existing = await provider.get(typeName, id)
      if (existing) {
        const result = await provider.update(typeName, id, data as Record<string, unknown>)
        return hydrateEntity(result, entity, schema, resolveProvider) as T
      }
      const result = await provider.create(typeName, id, data as Record<string, unknown>)
      return hydrateEntity(result, entity, schema, resolveProvider) as T
    },

    async delete(id: string): Promise<boolean> {
      const provider = await resolveProvider()
      return provider.delete(typeName, id)
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: T) => void | Promise<void>),
      maybeCallback?: (entity: T) => void | Promise<void>
    ): Promise<void> {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch(
      query: string,
      options?: SemanticSearchOptions
    ): Promise<Array<T & { $score: number }>> {
      const provider = await resolveProvider()
      if (hasSemanticSearch(provider)) {
        const results: SemanticSearchResult[] = await provider.semanticSearch(
          typeName,
          query,
          options
        )
        return Promise.all(
          results.map(
            (r: SemanticSearchResult) =>
              ({
                ...hydrateEntity(r, entity, schema, resolveProvider),
                $score: r.$score,
              } as T & { $score: number })
          )
        )
      }
      return []
    },

    async hybridSearch(
      query: string,
      options?: HybridSearchOptions
    ): Promise<
      Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
    > {
      const provider = await resolveProvider()
      if (hasHybridSearch(provider)) {
        const results: HybridSearchResult[] = await provider.hybridSearch(typeName, query, options)
        return Promise.all(
          results.map(
            (r: HybridSearchResult) =>
              ({
                ...hydrateEntity(r, entity, schema, resolveProvider),
                $rrfScore: r.$rrfScore,
                $ftsRank: r.$ftsRank,
                $semanticRank: r.$semanticRank,
                $score: r.$score,
              } as T & {
                $rrfScore: number
                $ftsRank: number
                $semanticRank: number
                $score: number
              })
          )
        )
      }
      return []
    },

    async draft(
      data: Partial<Omit<T, '$id' | '$type'>>,
      options?: DraftOptions
    ): Promise<Draft<T>> {
      const draftData: Record<string, unknown> = { ...data, $phase: 'draft' }
      const refs: Record<string, ReferenceSpec | ReferenceSpec[]> = {}

      // Get the raw schema to detect prompt fields and source instructions
      const rawSchema = entity.schema || {}
      const sourceInstructions = rawSchema.$instructions as string | undefined
      const hasContextDependencies =
        Array.isArray(rawSchema.$context) && rawSchema.$context.length > 0

      for (const [fieldName, field] of entity.fields) {
        if (draftData[fieldName] !== undefined && draftData[fieldName] !== null) {
          continue
        }

        if (field.operator && field.relatedType) {
          // Skip optional relation fields - they shouldn't auto-generate
          if (field.isOptional) continue

          // Skip backward references - they're resolved lazily via hydrateEntity
          // Backward refs find entities that reference US, not entities we create
          if (field.operator === '<-' || field.operator === '<~') continue

          // Relationship field with operator
          const matchMode = field.matchMode ?? (field.operator.includes('~') ? 'fuzzy' : 'exact')

          if (field.isArray) {
            // Get hint value for array fuzzy matching (e.g., categoriesHint for categories field)
            const hintKey = `${fieldName}Hint`
            const hintValue = (data as Record<string, unknown>)[hintKey]

            // Get fuzzy threshold from entity schema
            const threshold = field.threshold ?? getFuzzyThreshold(entity)

            // If hint is an array, create one ref spec per hint item
            const hints = Array.isArray(hintValue)
              ? hintValue
              : hintValue
              ? [hintValue]
              : [
                  generateNaturalLanguageContent(
                    fieldName,
                    field.prompt,
                    field.relatedType,
                    data as Record<string, unknown>
                  ),
                ]

            const refSpecs: ReferenceSpec[] = hints.map((hint: unknown) => {
              const generatedText = String(hint)
              return {
                field: fieldName,
                operator: field.operator!,
                type: field.relatedType!,
                unionTypes: field.unionTypes,
                matchMode,
                resolved: false,
                prompt: field.prompt,
                generatedText,
                sourceInstructions,
                threshold,
              }
            })

            // Store the combined generated text for the draft display
            draftData[fieldName] = hints.map(String).join(', ')
            refs[fieldName] = refSpecs

            if (options?.stream && options.onChunk) {
              for (const spec of refSpecs) {
                options.onChunk(spec.generatedText!)
              }
            }
          } else {
            // Get hint value for fuzzy matching (e.g., contentHint for content field)
            const hintKey = `${fieldName}Hint`
            const hintValue = (data as Record<string, unknown>)[hintKey] as string | undefined

            // Get fuzzy threshold from entity schema
            const threshold = field.threshold ?? getFuzzyThreshold(entity)

            // Use hint if available, otherwise generate natural language content
            const generatedText =
              hintValue ||
              generateNaturalLanguageContent(
                fieldName,
                field.prompt,
                field.relatedType,
                data as Record<string, unknown>
              )
            draftData[fieldName] = generatedText

            refs[fieldName] = {
              field: fieldName,
              operator: field.operator,
              type: field.relatedType,
              unionTypes: field.unionTypes,
              matchMode,
              resolved: false,
              prompt: field.prompt,
              generatedText, // This now uses the hint if provided
              sourceInstructions,
              threshold,
            }

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          }
        } else if (!field.isRelation) {
          // Non-relationship field - check if it's a prompt field
          // Prompt fields have a type that contains spaces, slashes, or question marks
          const isPromptField =
            field.type.includes(' ') || field.type.includes('/') || field.type.includes('?')

          if (isPromptField && !hasContextDependencies) {
            // Generate content for prompt field using the type as the prompt
            // NOTE: Skip generation when entity has $context dependencies, as those fields
            // need the pre-fetched context to generate properly (done in generateAIFields)
            const generatedText = generateContextAwareValue(
              fieldName,
              typeName,
              field.type,
              field.type,
              data as Record<string, unknown>
            )
            draftData[fieldName] = generatedText

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          }
        }
      }

      draftData.$refs = refs
      return draftData as Draft<T>
    },

    async resolve(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>> {
      // Draft<T> interface requires $phase: 'draft', so we can access it directly
      if (draft.$phase !== 'draft') {
        throw new Error('Cannot resolve entity: not a draft (missing $phase: "draft")')
      }

      const provider = await resolveProvider()
      const resolved: Record<string, unknown> = { ...draft }
      const errors: Array<{ field: string; error: string }> = []

      delete resolved.$refs
      resolved.$phase = 'resolved'

      const refs = draft.$refs

      for (const [fieldName, refSpec] of Object.entries(refs)) {
        try {
          if (Array.isArray(refSpec)) {
            const resolvedIds: string[] = []
            for (const spec of refSpec) {
              const resolvedId = await resolveReferenceSpec(
                spec,
                resolved,
                schema,
                provider,
                generateContextAwareValue,
                generateEntity
              )
              if (resolvedId) {
                resolvedIds.push(resolvedId)
                options?.onResolved?.(fieldName, resolvedId)
              }
            }
            resolved[fieldName] = resolvedIds
          } else {
            const resolvedId = await resolveReferenceSpec(
              refSpec,
              resolved,
              schema,
              provider,
              generateContextAwareValue,
              generateEntity
            )
            if (resolvedId) {
              resolved[fieldName] = resolvedId
              options?.onResolved?.(fieldName, resolvedId)
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          if (options?.onError === 'skip') {
            errors.push({ field: fieldName, error: errorMsg })
          } else {
            throw err
          }
        }
      }

      if (errors.length > 0 || options?.onError === 'skip') {
        // resolved is typed as Record<string, unknown>, so we can assign $errors directly
        resolved.$errors = errors
      }

      return resolved as Resolved<T>
    },
  }
}

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

  // Add Edge entity to the parsed schema
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
    if (entityName !== 'Edge') {
      const edgeRecords = createEdgeRecords(entityName, schema[entityName] ?? {}, entity)
      allEdgeRecords.push(...edgeRecords)
    }
  }

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
    async get(id: string) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        const action = await provider.getAction(id)
        if (!action) return null
        // Adapt DBAction to ForEachActionState
        return {
          id: action.id,
          type: action.action ?? action.type ?? 'unknown',
          status: action.status,
          progress: action.progress,
          total: action.total,
          data: action.objectData ?? {},
          result: action.result as import('../ai-promise-db.js').ForEachResult | undefined,
          error: action.error,
        }
      }
      return null
    },
    async update(id: string, updates: Partial<import('../ai-promise-db.js').ForEachActionState>) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        await provider.updateAction(id, {
          status: updates.status,
          progress: updates.progress,
          // ForEachResult needs to be converted to Record<string, unknown> for DBAction.result
          result: updates.result as Record<string, unknown> | undefined,
          error: updates.error,
        })
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
      const edgeOps = createEdgeEntityOperations(allEdgeRecords, resolveProvider)
      const wrappedEdgeOps = wrapEntityOperations(entityName, edgeOps, actionsAPI) as Record<
        string,
        unknown
      >
      entityOperations[entityName] = makeCallableEntityOps(wrappedEdgeOps, entityName)
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
        ;(draft as Record<string, unknown>).$type = entityName
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
          ;(resolved as Record<string, unknown>).$type = entityName
        }
        emitInternalEventForOps('resolve', resolved)
        return resolved
      }
      wrappedOps.resolve = resolveFn

      const originalCreate = wrappedOps.create
      wrappedOps.create = async (...args: unknown[]): Promise<unknown> => {
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
        const hasReferenceFields =
          entityDef &&
          Array.from(entityDef.fields.values()).some((field) => field.operator && field.relatedType)

        const effectiveMaxDepth = options?.maxDepth ?? (options?.cascade ? 3 : 0)

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
              rootOnProgress: options.onProgress,
              rootOnError: options.onError,
              stopOnError: options.stopOnError,
              cascadeTypes: options.cascadeTypes,
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
                  const parentInstructions = entityDef.schema?.$instructions as string | undefined
                  const childInstructions = relatedEntity.schema?.$instructions as
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
                  const createFn = relatedOps?.create as
                    | ((
                        data: Record<string, unknown>,
                        opts?: CreateEntityOptions
                      ) => Promise<Record<string, unknown>>)
                    | undefined
                  const childEntity = createFn
                    ? await createFn(childEntityData, childOptions)
                    : undefined

                  if (childEntity?.$id) {
                    cascadeState.totalEntitiesCreated++
                    if (field.isArray) {
                      cascadeData[fieldName] = [childEntity.$id]
                    } else {
                      cascadeData[fieldName] = childEntity.$id
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

            let result
            if (id) {
              result = await originalCreate.call(wrappedOps, id, cascadeData)
            } else {
              result = await originalCreate.call(wrappedOps, cascadeData)
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
          const draft = await draftFn(data)

          // Phase 2: Resolve - convert refs to actual entity IDs
          const resolved = await resolveFn(draft)

          // Extract clean data for persistence (remove $phase, $refs, $errors)
          const { $phase, $refs, $errors, $type, ...cleanData } = resolved as Record<
            string,
            unknown
          >

          // Persist the resolved entity
          let result
          if (id) {
            result = await originalCreate.call(wrappedOps, id, cleanData)
          } else {
            result = await originalCreate.call(wrappedOps, cleanData)
          }

          return result
        }

        return originalCreate.call(wrappedOps, ...args)
      }

      // Add seed method if entity has seed configuration
      if (entity.seedConfig) {
        const seedConfig = entity.seedConfig
        ;(wrappedOps as Record<string, unknown>).seed = async (): Promise<{ count: number }> => {
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
