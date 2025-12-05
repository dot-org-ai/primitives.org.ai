/**
 * Core Type Definitions
 *
 * Contains all foundational types for ai-database:
 * - Thing types (mdxld-based entity structure)
 * - Schema definition types
 * - Parsed schema types
 * - Noun & Verb semantic types
 *
 * @packageDocumentation
 */

import type { MDXLD } from 'mdxld'

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
  return {
    id: $id,
    type: $type,
    context: $context,
    data: rest,
    content: typeof rest.content === 'string' ? rest.content : '',
  }
}

/**
 * Convert expanded thing to flat format
 */
export function toFlat(expanded: ThingExpanded): ThingFlat {
  const { id, type, context, data, content, ...rest } = expanded
  return {
    $id: id,
    $type: type,
    $context: context,
    ...data,
    ...rest,
    ...(content ? { content } : {}),
  }
}

// =============================================================================
// Schema Definition Types
// =============================================================================

/**
 * Primitive field types
 */
export type PrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'markdown'
  | 'url'

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
 * Parsed field information
 */
export interface ParsedField {
  name: string
  type: string
  isArray: boolean
  isOptional: boolean
  isRelation: boolean
  relatedType?: string
  backref?: string
}

/**
 * Parsed entity with all fields including auto-generated backrefs
 */
export interface ParsedEntity {
  name: string
  fields: Map<string, ParsedField>
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

/**
 * Verb conjugations and related forms
 *
 * Maps an action to its various grammatical forms and semantic relationships.
 *
 * @example
 * ```ts
 * const create: Verb = {
 *   action: 'create',      // Base form (imperative)
 *   actor: 'creator',      // Who does it (noun)
 *   act: 'creates',        // Present tense (3rd person)
 *   activity: 'creating',  // Gerund/continuous
 *   result: 'creation',    // Result noun
 *   reverse: {             // Passive/result properties
 *     at: 'createdAt',
 *     by: 'createdBy',
 *     in: 'createdIn',
 *     for: 'createdFor',
 *   },
 *   inverse: 'delete',     // Opposite action
 * }
 * ```
 */
export interface Verb {
  /** Base form / imperative (create, update, delete, publish) */
  action: string

  /** Agent noun - who performs the action (creator, updater, author, publisher) */
  actor?: string

  /** Present tense 3rd person singular (creates, updates, deletes, publishes) */
  act?: string

  /** Present participle / gerund (creating, updating, deleting, publishing) */
  activity?: string

  /** Result noun - what is produced (creation, update, deletion, publication) */
  result?: string

  /** Reverse/passive forms - properties resulting from the action */
  reverse?: {
    /** Timestamp field (createdAt, updatedAt, deletedAt, publishedAt) */
    at?: string
    /** Actor reference (createdBy, updatedBy, deletedBy, publishedBy) */
    by?: string
    /** Location/context (createdIn, updatedIn, publishedIn) */
    in?: string
    /** Purpose/target (createdFor, publishedFor) */
    for?: string
    /** Additional reverse forms */
    [key: string]: string | undefined
  }

  /** Inverse action (create ↔ delete, publish ↔ unpublish, activate ↔ deactivate) */
  inverse?: string

  /** Description of what this action does */
  description?: string
}

/**
 * Standard CRUD verbs with pre-defined conjugations
 */
export const Verbs = {
  create: {
    action: 'create',
    actor: 'creator',
    act: 'creates',
    activity: 'creating',
    result: 'creation',
    reverse: { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' },
    inverse: 'delete',
  },
  update: {
    action: 'update',
    actor: 'updater',
    act: 'updates',
    activity: 'updating',
    result: 'update',
    reverse: { at: 'updatedAt', by: 'updatedBy' },
  },
  delete: {
    action: 'delete',
    actor: 'deleter',
    act: 'deletes',
    activity: 'deleting',
    result: 'deletion',
    reverse: { at: 'deletedAt', by: 'deletedBy' },
    inverse: 'create',
  },
  publish: {
    action: 'publish',
    actor: 'publisher',
    act: 'publishes',
    activity: 'publishing',
    result: 'publication',
    reverse: { at: 'publishedAt', by: 'publishedBy' },
    inverse: 'unpublish',
  },
  archive: {
    action: 'archive',
    actor: 'archiver',
    act: 'archives',
    activity: 'archiving',
    result: 'archive',
    reverse: { at: 'archivedAt', by: 'archivedBy' },
    inverse: 'unarchive',
  },
} as const satisfies Record<string, Verb>

/**
 * Noun definition - semantic description of an entity type
 *
 * Describes a Thing with its properties, relationships, available actions,
 * and metadata like singular/plural forms for natural language generation.
 *
 * @example
 * ```ts
 * const Post: Noun = {
 *   singular: 'post',
 *   plural: 'posts',
 *   description: 'A blog post or article',
 *
 *   properties: {
 *     title: { type: 'string', description: 'The post title' },
 *     content: { type: 'markdown', description: 'The post body' },
 *     status: { type: 'string', description: 'draft | published | archived' },
 *   },
 *
 *   relationships: {
 *     author: { type: 'Author', backref: 'posts', description: 'Who wrote this' },
 *     tags: { type: 'Tag[]', backref: 'posts', description: 'Categorization' },
 *   },
 *
 *   actions: ['create', 'update', 'delete', 'publish', 'archive'],
 *
 *   events: ['created', 'updated', 'deleted', 'published', 'archived'],
 * }
 * ```
 */
export interface Noun {
  /** Singular form (post, user, category) */
  singular: string

  /** Plural form (posts, users, categories) */
  plural: string

  /** Human-readable description */
  description?: string

  /** Property definitions with descriptions */
  properties?: Record<string, NounProperty>

  /** Relationship definitions with descriptions */
  relationships?: Record<string, NounRelationship>

  /** Actions that can be performed on this noun (verbs) */
  actions?: Array<string | Verb>

  /** Events that can occur to this noun */
  events?: string[]

  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Property definition within a Noun
 */
export interface NounProperty {
  /** Field type */
  type: PrimitiveType | string

  /** Human-readable description (also used as generation prompt) */
  description?: string

  /** Whether the field is optional */
  optional?: boolean

  /** Whether the field is an array */
  array?: boolean

  /** Default value */
  default?: unknown

  /** Example values for documentation/generation */
  examples?: unknown[]
}

/**
 * Relationship definition within a Noun
 */
export interface NounRelationship {
  /** Related entity type (e.g., 'Author', 'Tag[]') */
  type: string

  /** Backref field name on the related entity */
  backref?: string

  /** Human-readable description */
  description?: string

  /** Whether this is a required relationship */
  required?: boolean
}

/**
 * Type metadata - automatically inferred from type name
 *
 * Available on every entity via `entity.$type` or `db.Post.$meta`
 */
export interface TypeMeta {
  /** Type name as defined in schema (e.g., 'Post', 'BlogPost') */
  name: string
  /** Singular form (e.g., 'post', 'blog post') */
  singular: string
  /** Plural form (e.g., 'posts', 'blog posts') */
  plural: string
  /** URL-safe slug (e.g., 'post', 'blog-post') */
  slug: string
  /** Plural slug (e.g., 'posts', 'blog-posts') */
  slugPlural: string

  // Verb-derived accessors
  /** Creator relationship name */
  creator: string
  /** Created timestamp field */
  createdAt: string
  /** Created by field */
  createdBy: string
  /** Updated timestamp field */
  updatedAt: string
  /** Updated by field */
  updatedBy: string

  // Event types
  /** Event type for creation (e.g., 'Post.created') */
  created: string
  /** Event type for update (e.g., 'Post.updated') */
  updated: string
  /** Event type for deletion (e.g., 'Post.deleted') */
  deleted: string
}
