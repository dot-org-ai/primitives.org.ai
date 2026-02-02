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
  // Two-Phase Draft/Resolve types
  Draft,
  Resolved,
  DraftOptions,
  ResolveOptions,
  ReferenceSpec,
  CreateEntityOptions,
  CascadeProgress,
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
  EventBridgeAPI,
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
  // Seed types
  SeedResult,
} from './schema.js'

// Export CreateEventOptions and CreateActionOptions from types.ts
// (the schema.js versions are for EventsAPI/ActionsAPI, these are for DBClientExtended)
export type { CreateEventOptions, CreateActionOptions } from './types.js'

export {
  // Thing conversion utilities
  toExpanded,
  toFlat,
  // Configuration
  setProvider,
  setNLQueryGenerator,
  getNLQueryGenerator,
  // AI Generation configuration
  configureAIGeneration,
  getAIGenerationConfig,
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
  // Verb derivation
  FORWARD_TO_REVERSE,
  BIDIRECTIONAL_PAIRS,
  deriveReverseVerb,
  fieldNameToVerb,
  isPassiveVerb,
  registerVerbPair,
  registerBidirectionalPair,
  registerFieldVerb,
  // Entity operations
  createEntityOperations,
  createEdgeEntityOperations,
  // NL Query execution
  buildNLQueryContext,
  executeNLQuery,
  createNLQueryFn,
  // Schema versioning
  computeSchemaHash,
  getSchemaVersion,
  setSchemaVersion,
  // Schema diff
  diffSchemas,
  // Migrations
  defineMigration,
  runMigrations,
} from './schema.js'

export type {
  AIGenerationConfig,
  EntityOperationsConfig,
  GenerationDetails,
  // Schema versioning types
  SchemaVersionInfo,
  // Schema diff types
  SchemaDiff,
  EntityDiff,
  // Migration types
  Migration,
  MigrationOperation,
  MigrationResult,
} from './schema.js'

export {
  MemoryProvider,
  MemoryTransaction,
  createMemoryProvider,
  Semaphore,
} from './memory-provider.js'

export {
  DataLoader,
  createRequestLoader,
  getRequestLoader,
  clearRequestLoader,
  withDataLoader,
  loadEntity,
} from './dataloader.js'

export { createDigitalObjectsProvider } from './digital-objects-provider.js'

export type {
  // Note: Event, Action, Artifact now exported from schema.js (types.ts)
  // memory-provider has different Event/Action/Artifact types (ActivityStreams style)
  Event as MemoryEvent,
  Action as MemoryAction,
  Artifact as MemoryArtifact,
  MemoryProviderOptions,
  // Embedding provider interface for pluggable embeddings
  EmbeddingProvider,
} from './memory-provider.js'

// Event/Action/Artifact types for @mdxdb adapters (simple event sourcing style)
export type { Event, Action, Artifact } from './schema.js'

// =============================================================================
// Events API - Public event subscription and emission
// =============================================================================

// Export event utilities and constants
export { StandardEventTypes, entityEvent, typePattern, actionPattern } from './events.js'

export type { StandardEventType } from './events.js'

// =============================================================================
// EventBridge - Cloudflare Queues integration
// =============================================================================

export { createEventBridge, createEventBridgeAPI } from './eventbridge.js'

export type {
  QueueMessage,
  QueueBinding,
  EventBridgeConfig,
  PublishEvent,
  PublishedEvent,
  ProcessResult,
  EventBridgeStats,
  SubscriptionHandler,
} from './eventbridge.js'

// =============================================================================
// Actions API - Durable execution for long-running operations
// =============================================================================

// Export action utilities and constants
export {
  ActionStatuses,
  isTerminal,
  isInProgress,
  canRetry,
  canCancel,
  getProgressPercent,
  formatActionStatus,
} from './actions.js'

export type { ActionStatusType } from './actions.js'

// Promise pipelining exports
export {
  DBPromise,
  isDBPromise,
  getRawDBPromise,
  createListPromise,
  createEntityPromise,
  createSearchPromise,
  wrapEntityOperations,
  setProviderResolver,
  setSchemaRelationInfo,
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

// Semantic Search exports
export {
  cosineSimilarity,
  computeRRF,
  extractEmbeddableText,
  generateContentHash,
  // NOTE: createMockSemanticProvider has been moved to test utilities.
  // Import from '../test/utils/mock-semantic.js' for testing.
  // The export is kept here temporarily for backward compatibility but is deprecated.
  createMockSemanticProvider,
} from './semantic.js'

export type {
  SemanticProvider,
  SemanticSearchOptions,
  SemanticSearchResult,
  HybridSearchOptions,
  HybridSearchResult,
  EmbeddingConfig,
  EmbeddingsConfig,
  WithSemanticScore,
  WithHybridScore,
} from './semantic.js'

// Re-export from schema.ts for convenience
export type {
  SemanticSearchOptions as DBSemanticSearchOptions,
  HybridSearchOptions as DBHybridSearchOptions,
  EmbeddingTypeConfig,
  EmbeddingsConfig as DBEmbeddingsConfig,
  DBOptions,
} from './schema.js'

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

// Document Database Types (for @mdxdb adapters)
// These are environment-agnostic types that work in any runtime
export type {
  // Document types
  Document,
  DocWithScore,
  // List/Search options and results
  DocListOptions,
  DocListResult,
  DocSearchOptions,
  DocSearchResult,
  // CRUD options and results
  DocGetOptions,
  DocSetOptions,
  DocSetResult,
  DocDeleteOptions,
  DocDeleteResult,
  // Database interfaces
  DocumentDatabase,
  DocumentDatabaseConfig,
  CreateDocumentDatabase,
  DocumentDatabaseWithViews,
  // View types
  ViewEntityItem,
  ViewComponent,
  ViewDocument,
  ViewContext,
  ViewRenderResult,
  ViewRelationshipMutation,
  ViewSyncResult,
  ViewManager,
} from './types.js'

// =============================================================================
// Durable Promise - Time-agnostic execution
// =============================================================================

// Core durable promise exports
export {
  DurablePromise,
  isDurablePromise,
  durable,
  DURABLE_PROMISE_SYMBOL,
  // Context management
  getCurrentContext,
  withContext,
  setDefaultContext,
  // Batch scheduler
  getBatchScheduler,
  setBatchScheduler,
} from './durable-promise.js'

export type {
  ExecutionPriority,
  DurablePromiseOptions,
  DurablePromiseResult,
  BatchScheduler,
} from './durable-promise.js'

// Execution queue for priority-based scheduling
export {
  ExecutionQueue,
  createExecutionQueue,
  getDefaultQueue,
  setDefaultQueue,
} from './execution-queue.js'

export type {
  ExecutionQueueOptions,
  QueueStats,
  BatchSubmission,
  BatchProvider,
  BatchRequest,
  BatchStatus,
  BatchResult,
} from './execution-queue.js'

// ClickHouse-backed durable provider
export { ClickHouseDurableProvider, createClickHouseDurableProvider } from './durable-clickhouse.js'

export type { ClickHouseExecutor, ClickHouseDurableConfig } from './durable-clickhouse.js'

// =============================================================================
// Generation Context - Context accumulation across cascading generations
// =============================================================================

export {
  GenerationContext,
  createGenerationContext,
  ContextOverflowError,
} from './schema/generation-context.js'

export type {
  Entity as GenerationEntity,
  GenerationContextOptions,
  ContextSnapshot,
  FieldContext,
  BuildContextOptions,
} from './schema/generation-context.js'

// =============================================================================
// Error Handling - Custom error classes with context
// =============================================================================

export {
  // Utility functions
  isNotFoundError,
  isEntityExistsError,
  isExpectedError,
  wrapDatabaseError,
  // Base error class
  DatabaseError,
  // Custom error classes
  EntityNotFoundError,
  EntityAlreadyExistsError,
  ValidationError,
  AIGenerationError,
  SemanticSearchError,
  // Capability errors (re-exported from provider-capabilities)
  CapabilityNotSupportedError,
  isCapabilityNotSupportedError,
} from './errors.js'

// =============================================================================
// Provider Capabilities - Runtime feature detection
// =============================================================================

export {
  detectCapabilities,
  requireCapability,
  warnIfUnavailable,
  clearCapabilityCache,
  clearWarningHistory,
  PROVIDER_CAPABILITY_MATRIX,
} from './provider-capabilities.js'

export type { ProviderCapabilities } from './provider-capabilities.js'

// Re-export digital-objects types
export type {
  Noun as DigitalNoun,
  NounDefinition,
  Verb as DigitalVerb,
  VerbDefinition,
  Thing as DigitalThing,
  Action as DigitalAction,
  ActionStatus as DigitalActionStatus,
  DigitalObjectsProvider,
} from 'digital-objects'

export { createMemoryProvider as createDigitalObjectsMemoryProvider } from 'digital-objects'

// =============================================================================
// Shared Constants
// =============================================================================

export {
  RelationOperator,
  DEFAULT_EMBEDDING_DIMENSIONS,
  EMBEDDING_DIMENSIONS,
} from './constants.js'
export type { RelationOperatorType } from './constants.js'

// =============================================================================
// RDB Provider Adapter - Bridges RDB and ai-database DBProvider interfaces
// =============================================================================

export { RDBProviderAdapter, createRDBAdapter } from './rdb-provider-adapter.js'
