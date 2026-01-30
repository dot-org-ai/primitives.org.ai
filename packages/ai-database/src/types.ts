/**
 * Core Type Definitions
 *
 * Contains all foundational types for ai-database:
 * - Thing types (mdxld-based entity structure)
 * - Schema definition types
 * - Parsed schema types
 * - Noun & Verb semantic types (re-exported from @graphdl/core)
 *
 * @packageDocumentation
 */

import type { MDXLD } from 'mdxld'
import type { ParsedFieldType, RelationshipOperatorType } from '@org.ai/types'
import type {
  Verb,
  VerbReverse,
  Noun,
  NounProperty,
  NounRelationship,
  TypeMeta,
  PrimitiveType,
} from '@graphdl/core'

import { Verbs } from '@graphdl/core'

// Re-export types from @graphdl/core for backward compatibility
export type { Verb, VerbReverse, Noun, NounProperty, NounRelationship, TypeMeta, PrimitiveType }
export { Verbs }

// =============================================================================
// Thing Types (mdxld-based entity structure)
// =============================================================================

/**
 * Flat Thing shape with $-prefixed metadata fields
 * Used for JSON-LD compatible serialization
 *
 * @example
 * ```ts
 * const post: ThingFlat = {
 *   $id: 'post-123',
 *   $type: 'Post',
 *   $context: 'https://schema.org',
 *   title: 'Hello World',
 *   content: '...',
 * }
 * ```
 */
export interface ThingFlat {
  /** Unique identifier */
  $id: string
  /** Entity type */
  $type: string
  /** JSON-LD context (optional) */
  $context?: string | Record<string, unknown>
  /** Additional data fields */
  [key: string]: unknown
}

/**
 * Expanded Thing shape with structured data and content
 * Used for full document representation (mdxld format)
 *
 * @example
 * ```ts
 * const post: ThingExpanded = {
 *   id: 'post-123',
 *   type: 'Post',
 *   context: 'https://schema.org',
 *   data: { title: 'Hello World', author: 'john' },
 *   content: '# Hello World\n\nThis is my post...',
 * }
 * ```
 */
export interface ThingExpanded extends MDXLD {
  /** Unique identifier */
  id: string
  /** Entity type */
  type: string
}

/**
 * Convert flat thing to expanded format
 */
export function toExpanded(flat: ThingFlat): ThingExpanded {
  const { $id, $type, $context, ...rest } = flat
  const result: ThingExpanded = {
    id: $id,
    type: $type,
    data: rest,
    content: typeof rest['content'] === 'string' ? rest['content'] : '',
  }
  if ($context !== undefined) {
    result.context = $context
  }
  return result
}

/**
 * Convert expanded thing to flat format
 */
export function toFlat(expanded: ThingExpanded): ThingFlat {
  const { id, type, context, data, content, ...rest } = expanded
  const result: ThingFlat = {
    $id: id,
    $type: type,
    ...data,
    ...rest,
    ...(content ? { content } : {}),
  }
  if (context !== undefined) {
    result.$context = context
  }
  return result
}

// =============================================================================
// Schema Definition Types
// =============================================================================

// PrimitiveType is imported from @graphdl/core and re-exported above

/**
 * A field definition can be:
 * - A primitive type: 'string', 'number', etc.
 * - A relation: 'Author.posts' (Type.backref)
 * - An array of primitives: 'string[]'
 * - An array relation: ['Author.posts'] (many-to-many with backref)
 * - Optional modifier: 'string?'
 */
export type FieldDefinition = string | [string]

/**
 * Schema for a single entity type
 */
export type EntitySchema = Record<string, FieldDefinition>

/**
 * Full database schema
 */
export type DatabaseSchema = Record<string, EntitySchema>

// =============================================================================
// Parsed Schema Types
// =============================================================================

/**
 * Parsed field information.
 * Extends ParsedFieldType from @org.ai/types with database-specific fields.
 */
export interface ParsedField extends ParsedFieldType {
  /** Whether the field is an array (required, extends optional base field) */
  isArray: boolean
  /** Whether the field is optional (required, extends optional base field) */
  isOptional: boolean
  /** Whether this is a relationship field */
  isRelation: boolean
  /** Operator used in field definition: ->, ~>, <-, <~ */
  operator?: RelationshipOperatorType
  /** Direction of the relationship */
  direction?: 'forward' | 'backward'
  /** Match mode for the relationship */
  matchMode?: 'exact' | 'fuzzy'
  /** Natural language prompt before operator */
  prompt?: string
  /** Seed column mapping (e.g., '$.columnName') - maps source column to this field */
  seedMapping?: string
}

/**
 * Seed configuration extracted from entity schema
 */
export interface SeedConfig {
  /** URL to fetch seed data from */
  url: string
  /** Column name to use as primary key (from $id field) */
  idColumn: string
  /** Map of field names to source column names */
  fieldMappings: Map<string, string>
}

/**
 * Parsed entity with all fields including auto-generated backrefs
 */
export interface ParsedEntity {
  name: string
  fields: Map<string, ParsedField>
  /** Original raw schema for accessing metadata like $fuzzyThreshold */
  schema?: EntitySchema
  /** Seed configuration if $seed is defined */
  seedConfig?: SeedConfig
}

/**
 * Fully parsed schema with bi-directional relationships resolved
 */
export interface ParsedSchema {
  entities: Map<string, ParsedEntity>
}

// =============================================================================
// Noun & Verb - Semantic Types for Self-Documenting Schemas
// =============================================================================

// Verb, VerbReverse, Noun, NounProperty, NounRelationship, TypeMeta, PrimitiveType,
// and Verbs are imported from @graphdl/core and re-exported above for backward compatibility.

// =============================================================================
// Graph Database Types (Entity-Relationship Model)
// =============================================================================

/**
 * Base identifier for all entities (URL-centric)
 */
export interface EntityId {
  /** Namespace (e.g., 'example.com', 'api.mdx.org.ai') */
  ns: string
  /** Type of the entity (e.g., 'user', 'post', 'comment') */
  type: string
  /** Unique identifier within the namespace and type */
  id: string
  /**
   * Full URL for the entity
   * Defaults to https://{ns}/{type}/{id}
   */
  url?: string
}

/**
 * A Thing is a node in the database (linked data style)
 */
export interface Thing<T extends Record<string, unknown> = Record<string, unknown>>
  extends EntityId {
  /** When the thing was created */
  createdAt: Date
  /** When the thing was last updated */
  updatedAt: Date
  /** Arbitrary properties */
  data: T
  /** JSON-LD context (optional) */
  '@context'?: string | Record<string, unknown>
}

/**
 * Relationship between two things (graph edge)
 */
export interface Relationship<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique identifier for the relationship */
  id: string
  /** Type of relationship (any string) */
  type: string
  /** Source thing URL */
  from: string
  /** Target thing URL */
  to: string
  /** When the relationship was created */
  createdAt: Date
  /** Optional relationship metadata */
  data?: T
}

/**
 * Resolve the URL for an entity
 */
export function resolveUrl(entity: EntityId): string {
  if (entity.url) return entity.url
  return `https://${entity.ns}/${entity.type}/${entity.id}`
}

/**
 * Resolve URL with just ns/id (no type in path)
 */
export function resolveShortUrl(entity: Pick<EntityId, 'ns' | 'id'>): string {
  return `https://${entity.ns}/${entity.id}`
}

/**
 * Parse a URL into EntityId components
 *
 * Supports both full URLs and type/id paths:
 * - Full URL: 'https://example.com/User/john' -> { ns: 'example.com', type: 'User', id: 'john' }
 * - Type/ID path: 'User/john' -> { ns: '', type: 'User', id: 'john' }
 * - Nested path: 'User/org/team/john' -> { ns: '', type: 'User', id: 'org/team/john' }
 */
export function parseUrl(url: string): EntityId {
  // Try parsing as a full URL first
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)

    if (parts.length === 1) {
      return {
        ns: parsed.host,
        type: '',
        id: parts[0]!,
        url,
      }
    }

    if (parts.length >= 2) {
      return {
        ns: parsed.host,
        type: parts[0]!,
        id: parts.slice(1).join('/'),
        url,
      }
    }

    throw new Error(`Invalid entity URL: ${url}`)
  } catch (e) {
    // Not a valid URL - treat as a type/id path
    const parts = url.split('/').filter(Boolean)

    if (parts.length === 1) {
      // Just an ID, no type
      return {
        ns: '',
        type: '',
        id: parts[0]!,
        url,
      }
    }

    if (parts.length >= 2) {
      // First part is type, rest is ID (may contain slashes)
      return {
        ns: '',
        type: parts[0]!,
        id: parts.slice(1).join('/'),
        url,
      }
    }

    throw new Error(`Invalid entity URL: ${url}`)
  }
}

// =============================================================================
// Query & Options Types
// =============================================================================

/**
 * Query options for finding things
 */
export interface QueryOptions {
  /** Filter by namespace */
  ns?: string
  /** Filter by type */
  type?: string
  /** Filter by properties (exact match) */
  where?: Record<string, unknown>
  /** Order by field */
  orderBy?: string
  /** Order direction */
  order?: 'asc' | 'desc'
  /** Limit results */
  limit?: number
  /** Skip results (for pagination) */
  offset?: number
}

/**
 * Search options for semantic/text search
 */
export interface ThingSearchOptions extends QueryOptions {
  /** The search query */
  query: string
  /** Fields to search in */
  fields?: string[]
  /** Minimum relevance score (0-1) */
  minScore?: number
}

/**
 * Options for creating a thing
 */
export interface CreateOptions<T extends Record<string, unknown>> {
  /** Namespace */
  ns: string
  /** Type of the thing */
  type: string
  /** ID (auto-generated if not provided) */
  id?: string
  /** Custom URL (auto-generated if not provided) */
  url?: string
  /** Initial data */
  data: T
  /** JSON-LD context */
  '@context'?: string | Record<string, unknown>
}

/**
 * Options for updating a thing
 */
export interface UpdateOptions<T extends Record<string, unknown>> {
  /** Partial data to merge */
  data: Partial<T>
}

/**
 * Options for creating a relationship
 */
export interface RelateOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Type of relationship */
  type: string
  /** Source thing URL */
  from: string
  /** Target thing URL */
  to: string
  /** Optional relationship data */
  data?: T
}

// =============================================================================
// Event, Action, Artifact Types (for workflow integration)
// =============================================================================

/**
 * Immutable event record
 */
export interface Event<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique identifier for the event */
  id: string
  /** Event type (e.g., 'Customer.created', 'Order.completed') */
  type: string
  /** When the event occurred */
  timestamp: Date
  /** Event source (workflow, user, system) */
  source: string
  /** Event data payload */
  data: T
  /** Optional correlation ID for tracing related events */
  correlationId?: string
  /** Optional causation ID (the event that caused this event) */
  causationId?: string
}

/**
 * Action status
 */
export type ActionStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'

/**
 * Action record for pending/active work
 */
export interface Action<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique identifier for the action */
  id: string
  /** Actor performing the action (user URL, agent ID, 'system') */
  actor: string
  /** Object being acted upon (thing URL) */
  object: string
  /** Action type (e.g., 'approve', 'process', 'review') */
  action: string
  /** Current status */
  status: ActionStatus
  /** When the action was created */
  createdAt: Date
  /** When the action was last updated */
  updatedAt: Date
  /** When the action started (status became 'active') */
  startedAt?: Date
  /** When the action completed or failed */
  completedAt?: Date
  /** Result of the action (when completed) */
  result?: unknown
  /** Error message (when failed) */
  error?: string
  /** Additional action metadata */
  metadata?: T
}

/**
 * Artifact type
 */
export type ArtifactType =
  | 'ast'
  | 'types'
  | 'esm'
  | 'cjs'
  | 'worker'
  | 'html'
  | 'markdown'
  | 'bundle'
  | 'sourcemap'
  | string

/**
 * Cached artifact for compiled/parsed content
 */
export interface Artifact<T = unknown> {
  /** Unique key for the artifact (usually source URL + artifact type) */
  key: string
  /** Type of artifact */
  type: ArtifactType
  /** Source URL or identifier */
  source: string
  /** Hash of the source content (for cache invalidation) */
  sourceHash: string
  /** When the artifact was created */
  createdAt: Date
  /** When the artifact expires (optional TTL) */
  expiresAt?: Date
  /** The artifact content */
  content: T
  /** Content size in bytes */
  size?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Options for creating an event
 */
export interface CreateEventOptions<T extends Record<string, unknown>> {
  /** Event type */
  type: string
  /** Event source */
  source: string
  /** Event data */
  data: T
  /** Optional correlation ID */
  correlationId?: string
  /** Optional causation ID */
  causationId?: string
}

/**
 * Options for creating an action
 */
export interface CreateActionOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Actor performing the action */
  actor: string
  /** Object being acted upon */
  object: string
  /** Action type */
  action: string
  /** Initial status (defaults to 'pending') */
  status?: ActionStatus
  /** Additional metadata */
  metadata?: T
}

/**
 * Options for storing an artifact
 */
export interface StoreArtifactOptions<T = unknown> {
  /** Unique key for the artifact */
  key: string
  /** Type of artifact */
  type: ArtifactType
  /** Source URL or identifier */
  source: string
  /** Hash of the source content */
  sourceHash: string
  /** The artifact content */
  content: T
  /** TTL in milliseconds (optional) */
  ttl?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Event query options
 */
export interface EventQueryOptions {
  /** Filter by event type */
  type?: string
  /** Filter by source */
  source?: string
  /** Filter by correlation ID */
  correlationId?: string
  /** Events after this timestamp */
  after?: Date
  /** Events before this timestamp */
  before?: Date
  /** Maximum number of events to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Action query options
 */
export interface ActionQueryOptions {
  /** Filter by actor */
  actor?: string
  /** Filter by object */
  object?: string
  /** Filter by action type */
  action?: string
  /** Filter by status */
  status?: ActionStatus | ActionStatus[]
  /** Maximum number of actions to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

// =============================================================================
// Database Client Interfaces
// =============================================================================

/**
 * Database client interface for graph operations
 */
export interface DBClient<TData extends Record<string, unknown> = Record<string, unknown>> {
  // Thing operations
  list(options?: QueryOptions): Promise<Thing<TData>[]>
  find(options: QueryOptions): Promise<Thing<TData>[]>
  search(options: ThingSearchOptions): Promise<Thing<TData>[]>
  get(url: string): Promise<Thing<TData> | null>
  getById(ns: string, type: string, id: string): Promise<Thing<TData> | null>
  set(url: string, data: TData): Promise<Thing<TData>>
  create(options: CreateOptions<TData>): Promise<Thing<TData>>
  update(url: string, options: UpdateOptions<TData>): Promise<Thing<TData>>
  upsert(options: CreateOptions<TData>): Promise<Thing<TData>>
  delete(url: string): Promise<boolean>

  // Iteration
  forEach(
    options: QueryOptions,
    callback: (thing: Thing<TData>) => void | Promise<void>
  ): Promise<void>

  // Relationship operations (outbound)
  relate<T extends Record<string, unknown> = Record<string, unknown>>(
    options: RelateOptions<T>
  ): Promise<Relationship<T>>
  unrelate(from: string, type: string, to: string): Promise<boolean>
  related(
    url: string,
    relationshipType?: string,
    direction?: 'from' | 'to' | 'both'
  ): Promise<Thing<TData>[]>
  relationships(
    url: string,
    type?: string,
    direction?: 'from' | 'to' | 'both'
  ): Promise<Relationship[]>

  // Reference operations (inbound - backlinks)
  references(url: string, relationshipType?: string): Promise<Thing<TData>[]>

  // Cleanup
  close?(): Promise<void>
}

/**
 * Extended DBClient with Events, Actions, and Artifacts
 */
export interface DBClientExtended<TData extends Record<string, unknown> = Record<string, unknown>>
  extends DBClient<TData> {
  // Event operations (immutable, append-only)
  /** Track an event (analytics-style, append-only) */
  track<T extends Record<string, unknown>>(options: CreateEventOptions<T>): Promise<Event<T>>
  getEvent(id: string): Promise<Event | null>
  queryEvents(options?: EventQueryOptions): Promise<Event[]>

  // Action operations ($.do, $.try, $.send patterns)
  /** Send an action (fire-and-forget, creates in pending state) */
  send<T extends Record<string, unknown>>(options: CreateActionOptions<T>): Promise<Action<T>>
  /** Do an action (create and immediately start, returns in active state) */
  do<T extends Record<string, unknown>>(options: CreateActionOptions<T>): Promise<Action<T>>
  /** Try an action (with built-in error handling) */
  try<T extends Record<string, unknown>>(
    options: CreateActionOptions<T>,
    fn: () => Promise<unknown>
  ): Promise<Action<T>>
  getAction(id: string): Promise<Action | null>
  queryActions(options?: ActionQueryOptions): Promise<Action[]>
  startAction(id: string): Promise<Action>
  completeAction(id: string, result?: unknown): Promise<Action>
  failAction(id: string, error: string): Promise<Action>
  cancelAction(id: string): Promise<Action>

  // Artifact operations (cached content)
  storeArtifact<T>(options: StoreArtifactOptions<T>): Promise<Artifact<T>>
  getArtifact<T = unknown>(key: string): Promise<Artifact<T> | null>
  getArtifactBySource(source: string, type: ArtifactType): Promise<Artifact | null>
  deleteArtifact(key: string): Promise<boolean>
  cleanExpiredArtifacts(): Promise<number>
}

// =============================================================================
// Document Database Types (for @mdxdb adapters)
// =============================================================================
// These types are for document-based storage (MDX files with frontmatter)
// as opposed to the graph-based DBClient types above.

/**
 * Query options for listing documents
 */
export interface DocListOptions {
  /** Maximum number of documents to return */
  limit?: number
  /** Number of documents to skip */
  offset?: number
  /** Field to sort by */
  sortBy?: string
  /** Sort order */
  sortOrder?: 'asc' | 'desc'
  /** Filter by type */
  type?: string | string[]
  /** Filter by path prefix */
  prefix?: string
}

/**
 * Document with optional score for search results
 */
export interface DocWithScore<TData = Record<string, unknown>> {
  /** Document ID/path */
  id?: string
  /** Document type */
  type?: string
  /** JSON-LD context */
  context?: string | Record<string, unknown>
  /** Document data (frontmatter) */
  data: TData
  /** Document content (markdown body) */
  content: string
  /** Relevance score (for search results) */
  score?: number
}

/**
 * Query result with pagination info
 */
export interface DocListResult<TData = Record<string, unknown>> {
  /** List of documents */
  documents: DocWithScore<TData>[]
  /** Total count of matching documents */
  total: number
  /** Whether there are more results */
  hasMore: boolean
}

/**
 * Search options for querying documents
 */
export interface DocSearchOptions extends DocListOptions {
  /** Search query string */
  query: string
  /** Fields to search in */
  fields?: string[]
  /** Enable semantic/vector search */
  semantic?: boolean
}

/**
 * Search result with relevance info
 */
export interface DocSearchResult<TData = Record<string, unknown>> extends DocListResult<TData> {
  /** Documents with relevance scores */
  documents: Array<DocWithScore<TData> & { score?: number }>
}

/**
 * Get options for retrieving a document
 */
export interface DocGetOptions {
  /** Include AST in response */
  includeAst?: boolean
  /** Include compiled code in response */
  includeCode?: boolean
}

/**
 * Set options for storing a document
 */
export interface DocSetOptions {
  /** Create only if document doesn't exist */
  createOnly?: boolean
  /** Update only if document exists */
  updateOnly?: boolean
  /** Expected version for optimistic locking */
  version?: string
}

/**
 * Set result with metadata
 */
export interface DocSetResult {
  /** Document ID/path */
  id: string
  /** New version after update */
  version?: string
  /** Whether document was created (vs updated) */
  created: boolean
}

/**
 * Delete options
 */
export interface DocDeleteOptions {
  /** Soft delete (mark as deleted) */
  soft?: boolean
  /** Expected version for optimistic locking */
  version?: string
}

/**
 * Delete result
 */
export interface DocDeleteResult {
  /** Document ID/path that was deleted */
  id: string
  /** Whether document was found and deleted */
  deleted: boolean
}

/**
 * Document interface for MDX document storage
 *
 * Generic document type for CRUD operations on MDX content.
 * Used as input/output for DocumentDatabase operations.
 */
export interface Document<TData = Record<string, unknown>> {
  /** Document ID/path */
  id?: string
  /** Document type ($type) */
  type?: string
  /** JSON-LD context ($context) */
  context?: string | Record<string, unknown>
  /** Document data (frontmatter fields) */
  data: TData
  /** Document content (markdown body) */
  content: string
}

/**
 * Database interface for MDX document storage
 *
 * All backend adapters (fs, sqlite, postgres, api, etc.) implement this interface.
 * Works in any JavaScript runtime (Node.js, Bun, Deno, Workers, Browser).
 *
 * @example
 * ```ts
 * // Using filesystem adapter
 * import { createFsDatabase } from '@mdxdb/fs'
 * const db = createFsDatabase({ root: './content' })
 *
 * // Using API adapter
 * import { createApiDatabase } from '@mdxdb/api'
 * const db = createApiDatabase({ baseUrl: 'https://api.example.com' })
 *
 * // Same interface regardless of backend
 * const doc = await db.get('posts/hello-world')
 * ```
 */
export interface DocumentDatabase<TData = Record<string, unknown>> {
  /**
   * List documents with optional filtering and pagination
   */
  list(options?: DocListOptions): Promise<DocListResult<TData>>

  /**
   * Search documents by query
   */
  search(options: DocSearchOptions): Promise<DocSearchResult<TData>>

  /**
   * Get a document by ID/path
   */
  get(id: string, options?: DocGetOptions): Promise<Document<TData> | null>

  /**
   * Set/create a document
   */
  set(id: string, document: Document<TData>, options?: DocSetOptions): Promise<DocSetResult>

  /**
   * Delete a document
   */
  delete(id: string, options?: DocDeleteOptions): Promise<DocDeleteResult>

  /**
   * Close database connection (for cleanup)
   */
  close?(): Promise<void>
}

/**
 * Database configuration base
 */
export interface DocumentDatabaseConfig {
  /** Optional namespace/prefix for all operations */
  namespace?: string
}

/**
 * Factory function type for creating database instances
 */
export type CreateDocumentDatabase<
  TConfig extends DocumentDatabaseConfig = DocumentDatabaseConfig,
  TData = Record<string, unknown>
> = (config: TConfig) => DocumentDatabase<TData>

// =============================================================================
// View Types - For bi-directional relationship rendering/extraction
// =============================================================================

/**
 * Entity item with standard fields (for views)
 */
export interface ViewEntityItem {
  /** Entity ID (URL or slug) */
  $id: string
  /** Entity type */
  $type?: string
  /** Entity data fields */
  [key: string]: unknown
}

/**
 * View component definition
 */
export interface ViewComponent {
  /** Component name (e.g., 'Tags', 'Posts') */
  name: string
  /** Entity type this component renders */
  entityType?: string
  /** Relationship predicate */
  relationship?: string
  /** Default columns to render */
  columns?: string[]
  /** Render format */
  format?: 'table' | 'list' | 'cards'
}

/**
 * A View document is a template that renders related entities
 */
export interface ViewDocument {
  /** View template ID */
  id: string
  /** Entity type this view is for */
  entityType: string
  /** The template content */
  template: string
  /** Components discovered in the template */
  components: ViewComponent[]
}

/**
 * Context for rendering a view
 */
export interface ViewContext {
  /** The entity URL this view is being rendered for */
  entityUrl: string
  /** Optional filters to apply */
  filters?: Record<string, unknown>
}

/**
 * Result of rendering a view
 */
export interface ViewRenderResult {
  /** The rendered markdown */
  markdown: string
  /** Entities that were rendered */
  entities: Record<string, ViewEntityItem[]>
}

/**
 * Relationship mutation from view extraction
 */
export interface ViewRelationshipMutation {
  /** Mutation type */
  type: 'add' | 'remove' | 'update'
  /** Relationship predicate */
  predicate: string
  /** Source entity URL */
  from: string
  /** Target entity URL */
  to: string
  /** Entity data */
  data?: Record<string, unknown>
  /** Previous entity data */
  previousData?: Record<string, unknown>
}

/**
 * Result of syncing changes from an edited view
 */
export interface ViewSyncResult {
  /** Relationship mutations to apply */
  mutations: ViewRelationshipMutation[]
  /** Entities that were created */
  created: ViewEntityItem[]
  /** Entities that were updated */
  updated: ViewEntityItem[]
}

/**
 * View manager interface
 */
export interface ViewManager {
  discoverViews(): Promise<ViewDocument[]>
  getView(viewId: string): Promise<ViewDocument | null>
  render(viewId: string, context: ViewContext): Promise<ViewRenderResult>
  sync(viewId: string, context: ViewContext, editedMarkdown: string): Promise<ViewSyncResult>
  inferRelationship(
    contextType: string,
    componentName: string
  ): Promise<{ predicate: string; direction: 'forward' | 'reverse' } | null>
}

/**
 * Extended DocumentDatabase interface with view support
 */
export interface DocumentDatabaseWithViews<TData = Record<string, unknown>>
  extends DocumentDatabase<TData> {
  views: ViewManager
}
