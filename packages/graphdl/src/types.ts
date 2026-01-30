/**
 * Core Type Definitions for GraphDL
 *
 * Provides foundational types for defining entity graphs with noun/verb semantics,
 * MDXLD conventions, and relationship operators.
 *
 * @packageDocumentation
 */

// =============================================================================
// Relationship Operators
// =============================================================================

/**
 * Relationship operators for defining relationships between entity types.
 *
 * | Operator | Direction | Match Mode | Use Case |
 * |----------|-----------|------------|----------|
 * | `->` | forward | exact | Foreign key reference |
 * | `~>` | forward | fuzzy | AI-matched semantic reference |
 * | `<-` | backward | exact | Backlink/parent reference |
 * | `<~` | backward | fuzzy | AI-matched backlink |
 */
export type RelationshipOperator = '->' | '~>' | '<-' | '<~'

/**
 * Direction of a relationship
 */
export type RelationshipDirection = 'forward' | 'backward'

/**
 * Match mode for resolving relationships
 */
export type RelationshipMatchMode = 'exact' | 'fuzzy'

// =============================================================================
// Parsed Relationship Types
// =============================================================================

/**
 * Result of parsing a relationship operator from a field definition
 */
export interface ParsedRelationship {
  /** The relationship operator: ->, ~>, <-, <~ */
  operator: RelationshipOperator
  /** Direction of the relationship */
  direction: RelationshipDirection
  /** Match mode for resolving the relationship */
  matchMode: RelationshipMatchMode
  /** The primary target type */
  targetType: string
  /** Backref field name on the related entity */
  backref?: string
  /** Whether this is an array relationship */
  isArray?: boolean
  /** Whether this is an optional relationship */
  isOptional?: boolean
  /** Whether this is a required relationship (! modifier) */
  isRequired?: boolean
  /** Whether the relationship must be unique (! modifier) */
  isUnique?: boolean
  /** Whether the relationship is indexed (# modifier) */
  isIndexed?: boolean
  /** Union types for polymorphic references (e.g., ->A|B|C parses to ['A', 'B', 'C']) */
  unionTypes?: string[]
  /** Similarity threshold for fuzzy matching (0-1), parsed from ~>Type(0.9) syntax */
  threshold?: number
  /** Natural language prompt before operator (for AI generation) */
  prompt?: string
}

// =============================================================================
// Verb Types - Action Semantics
// =============================================================================

/**
 * Reverse/passive forms of a verb - properties resulting from the action
 */
export interface VerbReverse {
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
  reverse?: VerbReverse

  /** Inverse action (create ↔ delete, publish ↔ unpublish, activate ↔ deactivate) */
  inverse?: string

  /** Description of what this action does */
  description?: string
}

// =============================================================================
// Noun Types - Entity Semantics
// =============================================================================

/**
 * Primitive field types supported in schema definitions
 *
 * Includes general types, precision numeric types, temporal types, and
 * binary types for compatibility with IceType, Apache Iceberg, Parquet,
 * ClickHouse, DuckDB, and other database schemas.
 *
 * | Type | Description |
 * |------|-------------|
 * | `string` | Text/varchar |
 * | `text` | Long-form text (equivalent to TEXT in SQL) |
 * | `number` | General numeric (float64 equivalent) |
 * | `int` | 32-bit integer |
 * | `long` | 64-bit integer |
 * | `bigint` | Arbitrary precision integer |
 * | `float` | 32-bit floating point |
 * | `double` | 64-bit floating point |
 * | `decimal` | Arbitrary precision decimal |
 * | `boolean` | True/false (alias: `bool`) |
 * | `date` | Date without time |
 * | `datetime` | Date with time |
 * | `timestamp` | Timestamp without timezone |
 * | `timestamptz` | Timestamp with timezone |
 * | `time` | Time without date |
 * | `uuid` | UUID identifier |
 * | `binary` | Binary/byte array |
 * | `json` | JSON object |
 * | `markdown` | Markdown text |
 * | `url` | URL string |
 * | `email` | Email address |
 */
export type PrimitiveType =
  | 'string'
  | 'text'
  | 'number'
  | 'int'
  | 'long'
  | 'bigint'
  | 'float'
  | 'double'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'timestamptz'
  | 'time'
  | 'uuid'
  | 'binary'
  | 'varchar'
  | 'char'
  | 'fixed'
  | 'map'
  | 'struct'
  | 'enum'
  | 'ref'
  | 'list'
  | 'json'
  | 'markdown'
  | 'url'
  | 'email'

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

  /** Relationship operator */
  operator?: RelationshipOperator

  /** Backref field name on the related entity */
  backref?: string

  /** Human-readable description */
  description?: string

  /** Whether this is a required relationship */
  required?: boolean
}

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

// =============================================================================
// Graph Definition Types
// =============================================================================

/**
 * A field definition can be:
 * - A primitive type: 'string', 'number', etc.
 * - A relation: '->Author.posts' (Type.backref)
 * - A type URI: 'https://schema.org.ai/Person'
 * - An array of primitives: 'string[]'
 * - An array relation: ['->Author.posts'] (many-to-many with backref)
 * - Optional modifier: 'string?'
 */
export type FieldDefinition = string | [string]

/**
 * Entity definition in the Graph DSL
 *
 * Can be:
 * - A type URI string: 'https://schema.org.ai/Person'
 * - An object with $type and field definitions
 */
export type EntityDefinition =
  | string
  | {
      /** MDXLD type URI */
      $type?: string
      /** Field definitions */
      [key: string]: FieldDefinition | string | undefined
    }

/**
 * Input to the Graph() DSL function
 */
export type GraphInput = Record<string, EntityDefinition>

// =============================================================================
// Parsed Graph Types
// =============================================================================

/**
 * Parsed field information
 */
export interface ParsedField {
  /** Field name */
  name: string
  /** Field type (string, number, etc.) */
  type: string
  /** Whether the field is an array */
  isArray: boolean
  /** Whether the field is optional */
  isOptional: boolean
  /** Whether this is a relationship field */
  isRelation: boolean
  /** Whether the field is required (! modifier) */
  isRequired?: boolean
  /** Whether the field must be unique (! modifier) */
  isUnique?: boolean
  /** Whether the field is indexed (# modifier) */
  isIndexed?: boolean
  /** Related type name for relationship fields */
  relatedType?: string
  /** Back-reference field name for inverse relationships */
  backref?: string
  /** Relationship operator if this is a relationship field */
  operator?: RelationshipOperator
  /** Direction of the relationship */
  direction?: RelationshipDirection
  /** Match mode for resolving the relationship */
  matchMode?: RelationshipMatchMode
  /** Threshold for fuzzy relationships */
  threshold?: number
  /** Union types if this is a union field */
  unionTypes?: string[]
  /** Natural language prompt for generation */
  prompt?: string
  /** Numeric precision for parametric types like decimal(precision, scale) */
  precision?: number
  /** Numeric scale for parametric types like decimal(precision, scale) */
  scale?: number
  /** Length parameter for parametric types like varchar(length), char(length), fixed(length) */
  length?: number
  /** Key type for map<K, V> generic */
  keyType?: string
  /** Value type for map<K, V> generic */
  valueType?: string
  /** Struct name for struct<Name> generic */
  structName?: string
  /** Enum name for enum<Name> generic */
  enumName?: string
  /** Reference target for ref<Target> generic */
  refTarget?: string
  /** Element type for list<T> generic */
  elementType?: string
}

/**
 * Passthrough directives for entity configuration
 *
 * Arbitrary $ prefixed properties that pass through the parser without
 * error, stored for downstream consumers like IceType, ClickHouse, etc.
 *
 * Common directives:
 * - `$partitionBy` - Partition key fields
 * - `$index` - Secondary index definitions
 * - `$fts` - Full-text search fields
 * - `$vector` - Vector/embedding configuration
 */
export type EntityDirectives = Record<string, unknown>

/**
 * Parsed entity with all fields
 */
export interface ParsedEntity {
  /** Entity name */
  name: string
  /** MDXLD type URI */
  $type?: string
  /** Parsed field definitions */
  fields: Map<string, ParsedField>
  /** Passthrough directives ($ prefixed properties except $type) */
  directives?: EntityDirectives
}

/**
 * Fully parsed graph schema
 */
export interface ParsedGraph {
  /** Map of entity name to parsed entity */
  entities: Map<string, ParsedEntity>
  /** Map of entity name to type URI */
  typeUris: Map<string, string>
}

// =============================================================================
// Type Metadata
// =============================================================================

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
