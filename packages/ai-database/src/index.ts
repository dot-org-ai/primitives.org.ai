/**
 * ai-database - Schema-first database with automatic bi-directional relationships
 *
 * @example
 * ```ts
 * const db = DB({
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
 * // Typed, provider-agnostic access
 * const post = await db.Post.get('123')
 * const author = await post.author  // Resolved Author
 * const posts = await db.Author.get('456').posts  // Post[]
 * ```
 *
 * Provider is resolved transparently from environment (DB_PROVIDER, DB_URL).
 *
 * @packageDocumentation
 */

export { DB } from './schema.js'
export type {
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
  // Noun & Verb semantic types
  Noun,
  NounProperty,
  NounRelationship,
  Verb,
  TypeMeta,
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
