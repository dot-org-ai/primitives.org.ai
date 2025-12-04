/**
 * ai-database - Schema-first database with automatic bi-directional relationships
 *
 * @example
 * ```ts
 * const { db, events, actions, artifacts, nouns, verbs } = DB({
 *   Post: {
 *     title: 'string',
 *     author: 'Author.posts',  // Creates Post.author -> Author AND Author.posts -> Post[]
 *   },
 *   Author: {
 *     name: 'string',
 *     // posts: Post[] is auto-created from the backref
 *   }
 * })
 *
 * // CRUD operations
 * const post = await db.Post.create({ title: 'Hello' })
 * await db.Post.update(post.$id, { title: 'Updated' })
 *
 * // Event subscription
 * events.on('Post.created', (event) => console.log(event))
 *
 * // Durable actions
 * const action = await actions.create({ type: 'generate', data: {} })
 * ```
 *
 * Provider is resolved transparently from environment (DATABASE_URL).
 *
 * @packageDocumentation
 */

export { DB } from './schema.js'
export type {
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
