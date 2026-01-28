/**
 * Schema Type Definitions
 *
 * Contains all type definitions and interfaces for the schema module.
 *
 * @packageDocumentation
 */

import type {
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  EntitySchema,
  DatabaseSchema,
  Verb,
  Noun,
  NounProperty,
  NounRelationship,
  PrimitiveType,
} from '../types.js'
import type { ValueGenerator } from './value-generators/types.js'

// Re-export types from main types.ts
export type {
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  EntitySchema,
  DatabaseSchema,
  Verb,
  Noun,
  NounProperty,
  NounRelationship,
  PrimitiveType,
}

// =============================================================================
// Two-Phase Draft/Resolve Types
// =============================================================================

/**
 * Reference specification for unresolved relationships in a draft
 */
export interface ReferenceSpec {
  /** Field name on the entity */
  field: string
  /** The relationship operator: ->, ~>, <-, <~ */
  operator: '->' | '~>' | '<-' | '<~'
  /** Target entity type (first type in union if union type) */
  type: string
  /** Union types to search (for fuzzy union references like ~>Type1|Type2) */
  unionTypes?: string[]
  /** Match mode for resolving */
  matchMode: 'exact' | 'fuzzy'
  /** Whether this reference is resolved */
  resolved: boolean
  /** Natural language prompt for generation */
  prompt?: string
  /** Generated natural language text (before resolution) */
  generatedText?: string
  /** Source entity's $instructions for context propagation */
  sourceInstructions?: string
  /** Fuzzy threshold for matching (from $fuzzyThreshold) */
  threshold?: number
}

/**
 * Draft entity with unresolved references
 *
 * A draft is an entity that has been generated but whose relationships
 * have not yet been resolved to actual entity IDs. This allows:
 * - Streaming draft content to users before relationships are resolved
 * - Batch resolution of multiple references for efficiency
 * - Draft-only mode for preview/editing before final creation
 */
export type Draft<T> = {
  /** Phase marker indicating this is a draft */
  $phase: 'draft'
  /** Unresolved reference specifications */
  $refs: Record<string, ReferenceSpec | ReferenceSpec[]>
} & Partial<T>

/**
 * Resolved entity after resolution phase
 */
export type Resolved<T> = {
  /** Phase marker indicating this has been resolved */
  $phase: 'resolved'
  /** Any errors that occurred during resolution */
  $errors?: Array<{ field: string; error: string }>
} & T

/**
 * Options for the draft() method
 */
export interface DraftOptions {
  /** Enable streaming of draft content */
  stream?: boolean
  /** Callback for streaming chunks */
  onChunk?: (chunk: string) => void
  /** @internal Skip generation for promptless array fields (used by create() without cascade) */
  _skipPromptlessRefs?: boolean
}

/**
 * Options for the resolve() method
 */
export interface ResolveOptions {
  /** How to handle resolution errors */
  onError?: 'throw' | 'skip'
  /** Callback when a reference is resolved */
  onResolved?: (fieldName: string, entityId: string) => void
}

/**
 * Progress event for cascade generation
 */
export interface CascadeProgress {
  /** Current phase: 'generating' during creation, 'complete' when finished */
  phase: 'generating' | 'complete'
  /** Current depth level in the cascade (0 = root entity) */
  depth: number
  /** Current type being generated */
  currentType?: string
  /** Total entities created so far */
  totalEntitiesCreated: number
}

/**
 * Internal cascade state passed during recursive cascade operations
 * @internal
 */
export interface CascadeState {
  /** Running count of entities created during cascade */
  totalEntitiesCreated: number
  /** Original maxDepth from the root call */
  initialMaxDepth: number
  /** Root progress callback */
  rootOnProgress?: (progress: CascadeProgress) => void
  /** Root error callback */
  rootOnError?: (error: Error) => void
  /** Whether to stop on first error */
  stopOnError?: boolean
  /** Types to include in cascade */
  cascadeTypes?: string[]
}

/**
 * Options for the create() method
 */
export interface CreateEntityOptions {
  /** Only create a draft, don't resolve references */
  draftOnly?: boolean
  /** Cascade creation to generate related entities */
  cascade?: boolean
  /** Maximum depth for cascade creation (default: 0, no cascade) */
  maxDepth?: number
  /** Progress callback for cascade operations */
  onProgress?: (progress: CascadeProgress) => void
  /** Error callback for cascade operations */
  onError?: (error: Error) => void
  /** Stop cascade on first error (default: false) */
  stopOnError?: boolean
  /** Filter which types to cascade (if not specified, cascade all) */
  cascadeTypes?: string[]
  /** @internal Internal cascade state - do not set directly */
  _cascadeState?: CascadeState
}

/**
 * Result of parsing a relationship operator from a field definition
 */
export interface OperatorParseResult {
  /** Natural language prompt before operator (for AI generation) */
  prompt?: string
  /** The relationship operator: ->, ~>, <-, <~ */
  operator?: '->' | '~>' | '<-' | '<~'
  /** Direction of the relationship */
  direction?: 'forward' | 'backward'
  /** Match mode for resolving the relationship */
  matchMode?: 'exact' | 'fuzzy'
  /** The primary target type */
  targetType: string
  /** Union types for polymorphic references (e.g., ->A|B|C parses to ['A', 'B', 'C']) */
  unionTypes?: string[]
  /** Similarity threshold for fuzzy matching (0-1), parsed from ~>Type(0.9) syntax */
  threshold?: number
}

// =============================================================================
// Entity Operations Types
// =============================================================================

export interface ListOptions {
  where?: Record<string, unknown>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  /**
   * Suppress errors and return empty array instead of throwing.
   * Useful for graceful degradation when the database is unavailable.
   */
  suppressErrors?: boolean
  /**
   * Error handler callback. If provided, errors are passed to this callback
   * instead of being thrown. The callback can return a fallback value.
   */
  onError?: (error: Error) => unknown[] | void
}

export interface SearchOptions extends ListOptions {
  fields?: string[]
  minScore?: number
}

/**
 * Options for semantic search
 */
export interface SemanticSearchOptions {
  /** Minimum similarity score (0-1) */
  minScore?: number
  /** Maximum number of results */
  limit?: number
}

/**
 * Options for hybrid search (FTS + semantic)
 */
export interface HybridSearchOptions {
  /** Minimum similarity score for semantic results */
  minScore?: number
  /** Maximum number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** RRF k parameter (default: 60) */
  rrfK?: number
  /** Weight for FTS results (default: 0.5) */
  ftsWeight?: number
  /** Weight for semantic results (default: 0.5) */
  semanticWeight?: number
}

/**
 * Embedding configuration for a specific entity type
 */
export interface EmbeddingTypeConfig {
  /** Fields to embed (defaults to text/markdown fields) */
  fields?: string[]
}

// =============================================================================
// Events/Actions/Artifacts API Types
// =============================================================================

/**
 * Actor data - who performed the action
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
 * Action data structure for durable execution
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
  /** @deprecated Use 'action' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

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

// =============================================================================
// API Interfaces
// =============================================================================

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

/**
 * Actions API for durable execution tracking
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
// Natural Language Query Types
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
 */
export type NLQueryFn<T = unknown> = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<NLQueryResult<T>>

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

/**
 * AI generator function type for NL queries
 */
export type NLQueryGenerator = (prompt: string, context: NLQueryContext) => Promise<NLQueryPlan>

// =============================================================================
// Options for AI-powered entity generation
// =============================================================================

export interface GenerateOptions {
  type: string
  count?: number
  data?: Record<string, unknown>
  mode?: 'sync' | 'background'
}

// =============================================================================
// DB Options
// =============================================================================

import type { EmbeddingsConfig } from '../semantic.js'

// Re-export EmbeddingsConfig for use in other schema modules
export type { EmbeddingsConfig }

/**
 * DB Options for configuring embeddings and other settings
 */
export interface DBOptions {
  /** Embedding configuration per type */
  embeddings?: EmbeddingsConfig
  /** Value generator for field generation (defaults to PlaceholderValueGenerator) */
  valueGenerator?: ValueGenerator
}
