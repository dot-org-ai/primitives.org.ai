/**
 * ai-database - Schema-first database with promise pipelining
 *
 * Supports both direct and destructured usage:
 *
 * @example Direct usage - everything on one object
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
  // Event types
  DBEvent,
  ActorData,
  CreateEventOptions as DBCreateEventOptions,
  // Action types
  DBAction,
  CreateActionOptions as DBCreateActionOptions,
  // Artifact types
  DBArtifact,
  // Natural Language Query types
  NLQueryResult,
  NLQueryFn,
  NLQueryGenerator,
  NLQueryContext,
  NLQueryPlan,
  // Graph Database Types (for @mdxdb adapters)
  EntityId,
  Thing,
  Relationship,
  // Query Types
  QueryOptions,
  ThingSearchOptions,
  CreateOptions,
  UpdateOptions,
  RelateOptions,
  // Event/Action/Artifact Option Types
  StoreArtifactOptions,
  EventQueryOptions,
  ActionQueryOptions,
  ActionStatus,
  ArtifactType,
  // Client Interfaces
  DBClient,
  DBClientExtended,
} from './schema.js'

// Export CreateEventOptions and CreateActionOptions from types.ts
// (the schema.js versions are for EventsAPI/ActionsAPI, these are for DBClientExtended)
export type {
  CreateEventOptions,
  CreateActionOptions,
} from './types.js'

export {
  // Thing conversion utilities
  toExpanded,
  toFlat,
  // Configuration
  setProvider,
  setNLQueryGenerator,
  // Schema parsing
  parseSchema,
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
  // URL utilities
  resolveUrl,
  resolveShortUrl,
  parseUrl,
} from './schema.js'

export {
  MemoryProvider,
  createMemoryProvider,
  Semaphore,
} from './memory-provider.js'

export type {
  // Note: Event, Action, Artifact now exported from schema.js (types.ts)
  // memory-provider has different Event/Action/Artifact types (ActivityStreams style)
  Event as MemoryEvent,
  Action as MemoryAction,
  Artifact as MemoryArtifact,
  MemoryProviderOptions,
} from './memory-provider.js'

// Event/Action/Artifact types for @mdxdb adapters (simple event sourcing style)
export type { Event, Action, Artifact } from './schema.js'

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

export type {
  DBPromiseOptions,
  ForEachOptions,
  ForEachResult,
  ForEachProgress,
  ForEachErrorAction,
} from './ai-promise-db.js'

// Authorization (FGA/RBAC) exports
export type {
  // Core primitives
  Subject,
  SubjectType,
  Resource,
  ResourceRef,
  ResourceType,

  // Role & Permission
  Permission,
  Role,
  RoleLevel,

  // Assignment
  Assignment,
  AssignmentInput,

  // Authorization checks
  AuthzCheckRequest,
  AuthzCheckResult,
  AuthzBatchCheckRequest,
  AuthzBatchCheckResult,

  // Hierarchy
  ResourceHierarchy,

  // Schema integration
  AuthorizedNoun,

  // Business roles
  BusinessRole,

  // Engine interface
  AuthorizationEngine,
} from './authorization.js'

export {
  // Standard definitions
  StandardHierarchies,
  StandardPermissions,
  CRUDPermissions,
  createStandardRoles,

  // Verb-scoped permissions
  verbPermission,
  nounPermissions,
  matchesPermission,

  // Helper functions
  parseSubject,
  formatSubject,
  parseResource,
  formatResource,
  subjectMatches,
  resourceMatches,

  // Schema integration
  authorizeNoun,
  linkBusinessRole,

  // In-memory engine
  InMemoryAuthorizationEngine,

  // Nouns
  RoleNoun,
  AssignmentNoun,
  PermissionNoun,
  AuthorizationNouns,
} from './authorization.js'
