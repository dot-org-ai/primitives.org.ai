/**
 * Schema-first Database Definition
 *
 * This file re-exports all schema functionality from the modular `./schema/` directory.
 * It serves as the main entry point for backwards compatibility.
 *
 * The actual implementation is split into smaller modules:
 * - schema/types.ts - TypeScript types/interfaces
 * - schema/parse.ts - Schema parsing logic
 * - schema/provider.ts - Database provider interface and resolution
 * - schema/resolve.ts - Resolution functions for entity hydration
 * - schema/cascade.ts - Cascade generation and context-aware value generation
 * - schema/semantic.ts - Fuzzy/semantic resolution functions
 * - schema/index.ts - Main factory and entity operations
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

// =============================================================================
// Re-exports from types.ts (core type definitions)
// =============================================================================

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
  // Options Types
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

// =============================================================================
// Re-exports from semantic.ts
// =============================================================================

export type { EmbeddingsConfig } from './semantic.js'

// =============================================================================
// Re-exports from linguistic.ts
// =============================================================================

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

// =============================================================================
// Re-exports from schema/types.ts (schema-specific types)
// =============================================================================

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
} from './schema/types.js'

// =============================================================================
// Re-exports from schema/parse.ts
// =============================================================================

export { parseOperator, parseField, parseSchema, isPrimitiveType } from './schema/parse.js'

// =============================================================================
// Re-exports from schema/provider.ts
// =============================================================================

export type { DBProvider, DBProviderExtended } from './schema/provider.js'
export { setProvider, resolveProvider } from './schema/provider.js'

// =============================================================================
// Re-exports from schema/resolve.ts
// =============================================================================

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
} from './schema/resolve.js'

// =============================================================================
// Re-exports from schema/cascade.ts
// =============================================================================

export {
  generateContextAwareValue,
  generateAIFields,
  generateEntity,
  resolveForwardExact,
  generateNaturalLanguageContent,
} from './schema/cascade.js'

// =============================================================================
// Re-exports from schema/semantic.ts
// =============================================================================

export { resolveBackwardFuzzy, resolveForwardFuzzy } from './schema/semantic.js'

// =============================================================================
// Re-exports from schema/index.ts (main factory and operations)
// =============================================================================

export {
  // Noun/Verb helpers
  defineNoun,
  defineVerb,
  nounToSchema,
  // Built-in schemas
  ThingSchema,
  NounSchema,
  VerbSchema,
  EdgeSchema,
  SystemSchema,
  // Schema utilities
  createEdgeRecords,
  createNounRecord,
  // NL Query
  setNLQueryGenerator,
  // DB Factory
  DB,
} from './schema/index.js'

export type {
  InferEntity,
  EntityOperations,
  PipelineEntityOperations,
  TypedDB,
  DBResult,
} from './schema/index.js'

// =============================================================================
// Convenience alias
// =============================================================================

export { parseSchema as parse } from './schema/parse.js'
