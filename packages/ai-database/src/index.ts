/**
 * ai-database - Schema-first database with promise pipelining
 *
 * @example
 * ```ts
 * const { db } = DB({
 *   Lead: {
 *     name: 'string',
 *     company: 'Company.leads',
 *   },
 *   Company: {
 *     name: 'string',
 *   }
 * })
 *
 * // Chain without await
 * const leads = db.Lead.list()
 * const qualified = await leads.filter(l => l.score > 80)
 *
 * // Batch relationship loading
 * const withCompanies = await leads.map(l => ({
 *   name: l.name,
 *   company: l.company,  // Batch loaded!
 * }))
 *
 * // Natural language queries
 * const results = await db.Lead`who closed deals this month?`
 * ```
 *
 * Provider is resolved transparently from environment (DATABASE_URL).
 *
 * @packageDocumentation
 */

export { DB } from './schema.js'
export type {
  // Thing types (mdxld-based)
  ThingFlat,
  ThingExpanded,
  // Schema types
  DatabaseSchema,
  EntitySchema,
  FieldDefinition,
  PrimitiveType,
  ParsedSchema,
  ParsedEntity,
  ParsedField,
  TypedDB,
  EntityOperations,
  PipelineEntityOperations,
  DBProvider,
  ListOptions,
  SearchOptions,
  InferEntity,
  GenerateOptions,
  // DB Result type
  DBResult,
  // Noun & Verb semantic types
  Noun,
  NounProperty,
  NounRelationship,
  Verb,
  TypeMeta,
  // API types
  EventsAPI,
  ActionsAPI,
  ArtifactsAPI,
  NounsAPI,
  VerbsAPI,
  DBEvent,
  DBAction,
  DBArtifact,
  // Natural Language Query types
  NLQueryResult,
  NLQueryFn,
  NLQueryGenerator,
  NLQueryContext,
  NLQueryPlan,
} from './schema.js'

export {
  // Thing conversion utilities
  toExpanded,
  toFlat,
  // Configuration
  setProvider,
  setNLQueryGenerator,
  // Schema Definition
  defineNoun,
  defineVerb,
  nounToSchema,
  Verbs,
  // AI Inference
  conjugate,
  pluralize,
  singularize,
  inferNoun,
  Type,
} from './schema.js'

export {
  MemoryProvider,
  createMemoryProvider,
  Semaphore,
} from './memory-provider.js'

export type {
  Event,
  Action,
  Artifact,
  MemoryProviderOptions,
} from './memory-provider.js'

// Promise pipelining exports
export {
  DBPromise,
  isDBPromise,
  getRawDBPromise,
  createListPromise,
  createEntityPromise,
  createSearchPromise,
  wrapEntityOperations,
  DB_PROMISE_SYMBOL,
  RAW_DB_PROMISE_SYMBOL,
} from './ai-promise-db.js'

export type { DBPromiseOptions } from './ai-promise-db.js'
