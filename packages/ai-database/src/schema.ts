/**
 * Schema-first Database Definition
 *
 * Declarative schema with automatic bi-directional relationships.
 * Uses mdxld conventions for entity structure.
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
 */

import type { MDXLD } from 'mdxld'
import { DBPromise, wrapEntityOperations, type ForEachOptions, type ForEachResult } from './ai-promise-db.js'
import {
  cosineSimilarity,
  computeRRF,
  extractEmbeddableText,
  generateContentHash,
  type EmbeddingsConfig,
  type SemanticSearchOptions as SemanticOpts,
  type HybridSearchOptions as HybridOpts,
} from './semantic.js'

// =============================================================================
// Re-exports from modular files
// =============================================================================

// Re-export types from types.ts
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
  // Options Types (Note: CreateEventOptions, CreateActionOptions defined locally below)
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

// Re-export semantic types
export type { EmbeddingsConfig } from './semantic.js'

// Re-export linguistic utilities from linguistic.ts
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

// Import for internal use
import type {
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
} from './types.js'

import { Verbs } from './types.js'

import {
  inferNoun,
  getTypeMeta,
  conjugate,
} from './linguistic.js'

/**
 * Create a Noun definition with type inference
 *
 * @example
 * ```ts
 * const Post = defineNoun({
 *   singular: 'post',
 *   plural: 'posts',
 *   description: 'A blog post',
 *   properties: {
 *     title: { type: 'string', description: 'Post title' },
 *     content: { type: 'markdown' },
 *   },
 *   relationships: {
 *     author: { type: 'Author', backref: 'posts' },
 *   },
 * })
 * ```
 */
export function defineNoun<T extends Noun>(noun: T): T {
  return noun
}

/**
 * Create a Verb definition with type inference
 *
 * @example
 * ```ts
 * const publish = defineVerb({
 *   action: 'publish',
 *   actor: 'publisher',
 *   act: 'publishes',
 *   activity: 'publishing',
 *   result: 'publication',
 *   reverse: { at: 'publishedAt', by: 'publishedBy' },
 *   inverse: 'unpublish',
 * })
 * ```
 */
export function defineVerb<T extends Verb>(verb: T): T {
  return verb
}

/**
 * Convert a Noun to an EntitySchema for use with DB()
 *
 * @example
 * ```ts
 * const postNoun = defineNoun({
 *   singular: 'post',
 *   plural: 'posts',
 *   properties: { title: { type: 'string' } },
 *   relationships: { author: { type: 'Author', backref: 'posts' } },
 * })
 *
 * const db = DB({
 *   Post: nounToSchema(postNoun),
 * })
 * ```
 */
export function nounToSchema(noun: Noun): EntitySchema {
  const schema: EntitySchema = {}

  // Add properties
  if (noun.properties) {
    for (const [name, prop] of Object.entries(noun.properties)) {
      let type = prop.type
      if (prop.array) type = `${type}[]`
      if (prop.optional) type = `${type}?`
      schema[name] = type
    }
  }

  // Add relationships
  if (noun.relationships) {
    for (const [name, rel] of Object.entries(noun.relationships)) {
      const baseType = rel.type.replace('[]', '')
      const isArray = rel.type.endsWith('[]')

      if (rel.backref) {
        schema[name] = isArray ? [`${baseType}.${rel.backref}`] : `${baseType}.${rel.backref}`
      } else {
        schema[name] = rel.type
      }
    }
  }

  return schema
}

// =============================================================================
// Built-in Schema Types - Self-Describing Database
// =============================================================================

/**
 * Built-in Thing schema - base type for all entities
 *
 * Every entity instance is a Thing with a relationship to its Noun.
 * This creates a complete graph: Thing.type -> Noun.things
 *
 * @example
 * ```ts
 * // Every post instance:
 * post.$type   // 'Post' (string)
 * post.type    // -> Noun('Post') (relationship)
 *
 * // From Noun, get all instances:
 * const postNoun = await db.Noun.get('Post')
 * const allPosts = await postNoun.things  // -> Post[]
 * ```
 */
export const ThingSchema: EntitySchema = {
  // Every Thing has a type that links to its Noun
  type: 'Noun.things',      // Thing.type -> Noun, Noun.things -> Thing[]
}

/**
 * Built-in Noun schema for storing type definitions
 *
 * Every Type/Collection automatically gets a Noun record stored in the database.
 * This enables introspection and self-describing schemas.
 *
 * @example
 * ```ts
 * // When you define:
 * const db = DB({ Post: { title: 'string' } })
 *
 * // The database auto-creates:
 * // db.Noun.get('Post') => { singular: 'post', plural: 'posts', ... }
 *
 * // Query all types:
 * const types = await db.Noun.list()
 *
 * // Get all instances of a type:
 * const postNoun = await db.Noun.get('Post')
 * const allPosts = await postNoun.things
 *
 * // Listen for new types:
 * on.Noun.created(noun => console.log(`New type: ${noun.name}`))
 * ```
 */
export const NounSchema: EntitySchema = {
  // Identity
  name: 'string',           // 'Post', 'BlogPost'
  singular: 'string',       // 'post', 'blog post'
  plural: 'string',         // 'posts', 'blog posts'
  slug: 'string',           // 'post', 'blog-post'
  slugPlural: 'string',     // 'posts', 'blog-posts'
  description: 'string?',   // Human description

  // Schema
  properties: 'json?',      // Property definitions
  relationships: 'json?',   // Relationship definitions

  // Behavior
  actions: 'json?',         // Available actions (verbs)
  events: 'json?',          // Event types

  // Metadata
  metadata: 'json?',        // Additional metadata

  // Relationships - auto-created by bi-directional system
  // things: Thing[]        // All instances of this type (backref from Thing.type)
}

/**
 * Built-in Verb schema for storing action definitions
 */
export const VerbSchema: EntitySchema = {
  action: 'string',         // 'create', 'publish'
  actor: 'string?',         // 'creator', 'publisher'
  act: 'string?',           // 'creates', 'publishes'
  activity: 'string?',      // 'creating', 'publishing'
  result: 'string?',        // 'creation', 'publication'
  reverse: 'json?',         // { at, by, in, for }
  inverse: 'string?',       // 'delete', 'unpublish'
  description: 'string?',
}

/**
 * Built-in Edge schema for relationships between types
 *
 * Every relationship in a schema creates an Edge record.
 * This enables graph queries across the type system.
 *
 * @example
 * ```ts
 * // Post.author -> Author creates:
 * // Edge { from: 'Post', name: 'author', to: 'Author', backref: 'posts', cardinality: 'many-to-one' }
 *
 * // Query the graph:
 * const edges = await db.Edge.find({ to: 'Author' })
 * // => [{ from: 'Post', name: 'author' }, { from: 'Comment', name: 'author' }]
 *
 * // What types reference Author?
 * const referencing = edges.map(e => e.from)  // ['Post', 'Comment']
 * ```
 */
export const EdgeSchema: EntitySchema = {
  from: 'string',           // Source type: 'Post'
  name: 'string',           // Field name: 'author'
  to: 'string',             // Target type: 'Author'
  backref: 'string?',       // Inverse field: 'posts'
  cardinality: 'string',    // 'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'
  direction: 'string',      // 'forward' | 'backward'
  matchMode: 'string?',     // 'exact' | 'fuzzy'
  required: 'boolean?',     // Is this relationship required?
  description: 'string?',   // Human description
}

/**
 * System types that are auto-created in every database
 *
 * The graph structure:
 * - Thing.type -> Noun (every instance links to its type)
 * - Noun.things -> Thing[] (every type has its instances)
 * - Edge connects Nouns (relationships between types)
 * - Verb describes actions on Nouns
 */
export const SystemSchema: DatabaseSchema = {
  Thing: ThingSchema,
  Noun: NounSchema,
  Verb: VerbSchema,
  Edge: EdgeSchema,
}

/**
 * Create Edge records from schema relationships
 *
 * @internal Used by DB() to auto-populate Edge records
 *
 * For backward edges (direction === 'backward'), the from/to are inverted:
 * - Forward: from = typeName, to = relatedType
 * - Backward: from = relatedType, to = typeName
 *
 * This enables proper graph traversal where backward edges represent
 * "pointing to" relationships (e.g., Post.comments -> Comments that point TO Post)
 */
export function createEdgeRecords(
  typeName: string,
  schema: EntitySchema,
  parsedEntity: ParsedEntity
): Array<Record<string, unknown>> {
  const edges: Array<Record<string, unknown>> = []

  for (const [fieldName, field] of parsedEntity.fields) {
    if (field.isRelation && field.relatedType) {
      const direction = field.direction ?? 'forward'
      const matchMode = field.matchMode ?? 'exact'

      // For backward edges, invert from/to and adjust cardinality
      const isBackward = direction === 'backward'
      const from = isBackward ? field.relatedType : typeName
      const to = isBackward ? typeName : field.relatedType

      // Cardinality from the perspective of the field definition
      // - Array with backref = many-to-many (Post.tags <-> Tag.posts)
      // - Array without backref = one-to-many (one source points to many targets)
      // - Single = many-to-one (many sources point to one target)
      // The 'one-to-one' case is rare and typically requires explicit constraint
      let cardinality: string
      if (field.isArray) {
        cardinality = field.backref ? 'many-to-many' : 'one-to-many'
      } else {
        // Single reference: by default many-to-one (many posts -> one author)
        cardinality = 'many-to-one'
      }

      edges.push({
        from,
        name: fieldName,
        to,
        backref: field.backref,
        cardinality,
        direction,
        matchMode,
      })
    }
  }

  return edges
}

/**
 * Create a Noun record from a type name and optional schema
 *
 * @internal Used by DB() to auto-populate Noun records
 */
export function createNounRecord(
  typeName: string,
  schema?: EntitySchema,
  nounDef?: Partial<Noun>
): Record<string, unknown> {
  const meta = getTypeMeta(typeName)
  const inferred = inferNoun(typeName)

  return {
    name: typeName,
    singular: nounDef?.singular ?? meta.singular,
    plural: nounDef?.plural ?? meta.plural,
    slug: meta.slug,
    slugPlural: meta.slugPlural,
    description: nounDef?.description,
    properties: nounDef?.properties ?? (schema ? schemaToProperties(schema) : undefined),
    relationships: nounDef?.relationships,
    actions: nounDef?.actions ?? inferred.actions,
    events: nounDef?.events ?? inferred.events,
    metadata: nounDef?.metadata,
  }
}

/**
 * Convert EntitySchema to NounProperty format
 */
function schemaToProperties(schema: EntitySchema): Record<string, NounProperty> {
  const properties: Record<string, NounProperty> = {}

  for (const [name, def] of Object.entries(schema)) {
    const defStr = Array.isArray(def) ? def[0] : def
    const isOptional = defStr.endsWith('?')
    const isArray = defStr.endsWith('[]') || Array.isArray(def)
    const baseType = defStr.replace(/[\?\[\]]/g, '').split('.')[0]!

    properties[name] = {
      type: baseType,
      optional: isOptional,
      array: isArray,
    }
  }

  return properties
}

// =============================================================================
// Schema Parsing
// =============================================================================

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
  /** Target entity type */
  type: string
  /** Match mode for resolving */
  matchMode: 'exact' | 'fuzzy'
  /** Whether this reference is resolved */
  resolved: boolean
  /** Natural language prompt for generation */
  prompt?: string
  /** Generated natural language text (before resolution) */
  generatedText?: string
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
export interface Draft<T> {
  /** Phase marker indicating this is a draft */
  $phase: 'draft'
  /** Unresolved reference specifications */
  $refs: Record<string, ReferenceSpec | ReferenceSpec[]>
  /** Entity data with natural language placeholders for references */
  [key: string]: unknown
}

/**
 * Resolved entity after resolution phase
 */
export interface Resolved<T> {
  /** Phase marker indicating this has been resolved */
  $phase: 'resolved'
  /** Any errors that occurred during resolution */
  $errors?: Array<{ field: string; error: string }>
  /** Entity data with resolved reference IDs */
  [key: string]: unknown
}

/**
 * Options for the draft() method
 */
export interface DraftOptions {
  /** Enable streaming of draft content */
  stream?: boolean
  /** Callback for streaming chunks */
  onChunk?: (chunk: string) => void
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
 * Progress tracking for cascade generation
 */
export interface CascadeProgress {
  /** Current phase of cascade generation */
  phase: 'generating' | 'complete' | 'error'
  /** Type currently being generated */
  currentType?: string
  /** Current recursion depth */
  currentDepth: number
  /** Alias for currentDepth for convenience */
  depth: number
  /** Total number of entities created during cascade */
  totalEntitiesCreated: number
  /** List of types that have been generated */
  typesGenerated: string[]
}

/**
 * Options for cascade generation
 */
export interface CascadeOptions {
  /** Enable cascade generation through relationships */
  cascade?: boolean
  /** Maximum depth for cascade recursion (default: 3) */
  maxDepth?: number
  /** Limit cascade to specific types */
  cascadeTypes?: string[]
  /** Progress callback for tracking cascade generation */
  onProgress?: (progress: CascadeProgress) => void
  /** Error callback for handling cascade errors */
  onError?: (error: Error, context: { type: string; depth: number }) => void
  /** Stop cascade on first error */
  stopOnError?: boolean
}

/**
 * Options for the create() method
 */
export interface CreateEntityOptions extends CascadeOptions {
  /** Only create a draft, don't resolve references */
  draftOnly?: boolean
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

/**
 * Parse relationship operator from field definition
 *
 * Extracts operator semantics from a field definition string. Supports
 * four relationship operators with different semantics:
 *
 * ## Operators
 *
 * | Operator | Direction | Match Mode | Description |
 * |----------|-----------|------------|-------------|
 * | `->`     | forward   | exact      | Strict foreign key reference |
 * | `~>`     | forward   | fuzzy      | AI-matched semantic reference |
 * | `<-`     | backward  | exact      | Strict backlink reference |
 * | `<~`     | backward  | fuzzy      | AI-matched backlink reference |
 *
 * ## Supported Formats
 *
 * - `'->Type'`           - Forward exact reference to Type
 * - `'~>Type'`           - Forward fuzzy (semantic search) to Type
 * - `'<-Type'`           - Backward exact reference from Type
 * - `'<~Type'`           - Backward fuzzy reference from Type
 * - `'Prompt text ->Type'` - With generation prompt (text before operator)
 * - `'->TypeA|TypeB'`    - Union types (polymorphic reference)
 * - `'->Type.backref'`   - With explicit backref field name
 * - `'->Type?'`          - Optional reference
 * - `'->Type[]'`         - Array of references
 *
 * @param definition - The field definition string to parse
 * @returns Parsed operator result, or null if no operator found
 *
 * @example Basic usage
 * ```ts
 * parseOperator('->Author')
 * // => { operator: '->', direction: 'forward', matchMode: 'exact', targetType: 'Author' }
 *
 * parseOperator('~>Category')
 * // => { operator: '~>', direction: 'forward', matchMode: 'fuzzy', targetType: 'Category' }
 *
 * parseOperator('<-Post')
 * // => { operator: '<-', direction: 'backward', matchMode: 'exact', targetType: 'Post' }
 * ```
 *
 * @example With prompt
 * ```ts
 * parseOperator('What is the main category? ~>Category')
 * // => {
 * //   prompt: 'What is the main category?',
 * //   operator: '~>',
 * //   direction: 'forward',
 * //   matchMode: 'fuzzy',
 * //   targetType: 'Category'
 * // }
 * ```
 *
 * @example Union types
 * ```ts
 * parseOperator('->Person|Company|Organization')
 * // => {
 * //   operator: '->',
 * //   direction: 'forward',
 * //   matchMode: 'exact',
 * //   targetType: 'Person',
 * //   unionTypes: ['Person', 'Company', 'Organization']
 * // }
 * ```
 */
export function parseOperator(definition: string): OperatorParseResult | null {
  // Supported operators in order of specificity (longer operators first)
  const operators = ['~>', '<~', '->', '<-'] as const

  for (const op of operators) {
    const opIndex = definition.indexOf(op)
    if (opIndex !== -1) {
      // Extract prompt (text before operator)
      const beforeOp = definition.slice(0, opIndex).trim()
      const prompt = beforeOp || undefined

      // Extract target type (text after operator)
      let targetType = definition.slice(opIndex + op.length).trim()

      // Determine direction: < = backward, otherwise forward
      const direction = op.startsWith('<') ? 'backward' : 'forward'

      // Determine match mode: ~ = fuzzy, otherwise exact
      const matchMode = op.includes('~') ? 'fuzzy' : 'exact'

      // Parse field-level threshold from ~>Type(0.9) syntax
      let threshold: number | undefined
      const thresholdMatch = targetType.match(/^([^(]+)\(([0-9.]+)\)(.*)$/)
      if (thresholdMatch) {
        const [, typePart, thresholdStr, suffix] = thresholdMatch
        threshold = parseFloat(thresholdStr!)
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          // Reconstruct targetType without the threshold
          targetType = (typePart || '') + (suffix || '')
        } else {
          threshold = undefined
        }
      }

      // Parse union types (A|B|C syntax)
      // First, strip off any modifiers (?, [], .backref) to get clean types
      let cleanType = targetType
      // Remove optional modifier for union parsing
      if (cleanType.endsWith('?')) {
        cleanType = cleanType.slice(0, -1)
      }
      // Remove array modifier for union parsing
      if (cleanType.endsWith('[]')) {
        cleanType = cleanType.slice(0, -2)
      }
      // Remove backref for union parsing (take only part before dot)
      const dotIndex = cleanType.indexOf('.')
      if (dotIndex !== -1) {
        cleanType = cleanType.slice(0, dotIndex)
      }

      // Check for union types
      let unionTypes: string[] | undefined
      if (cleanType.includes('|')) {
        unionTypes = cleanType.split('|').map(t => t.trim()).filter(Boolean)
        // The primary targetType is the first union type
        // But we keep targetType as the full string for backward compatibility
        // with modifier parsing in parseField
      }

      return {
        prompt,
        operator: op,
        direction,
        matchMode,
        targetType,
        unionTypes,
        threshold,
      }
    }
  }

  return null
}

/**
 * Parse a single field definition
 *
 * Converts a field definition string into a structured ParsedField object,
 * handling primitives, relations, arrays, optionals, and operator syntax.
 *
 * @param name - The field name
 * @param definition - The field definition (string or array)
 * @returns Parsed field information
 */
function parseField(name: string, definition: FieldDefinition): ParsedField {
  // Handle array literal syntax: ['Author.posts']
  if (Array.isArray(definition)) {
    const inner = parseField(name, definition[0])
    return { ...inner, isArray: true }
  }

  let type = definition
  let isArray = false
  let isOptional = false
  let isRelation = false
  let relatedType: string | undefined
  let backref: string | undefined
  let operator: '->' | '~>' | '<-' | '<~' | undefined
  let direction: 'forward' | 'backward' | undefined
  let matchMode: 'exact' | 'fuzzy' | undefined
  let prompt: string | undefined
  let unionTypes: string[] | undefined

  // Use the dedicated operator parser
  const operatorResult = parseOperator(type)
  if (operatorResult) {
    operator = operatorResult.operator
    direction = operatorResult.direction
    matchMode = operatorResult.matchMode
    prompt = operatorResult.prompt
    type = operatorResult.targetType
    // Propagate union types if present
    if (operatorResult.unionTypes && operatorResult.unionTypes.length > 1) {
      unionTypes = operatorResult.unionTypes
    }
  }

  // Check for optional modifier
  if (type.endsWith('?')) {
    isOptional = true
    type = type.slice(0, -1)
  }

  // Check for array modifier (string syntax)
  if (type.endsWith('[]')) {
    isArray = true
    type = type.slice(0, -2)
  }

  // Handle union types in type string (for relatedType extraction)
  // If we have union types, use the first one as the primary type
  if (unionTypes && unionTypes.length > 0) {
    type = unionTypes[0]!
    isRelation = true
    relatedType = unionTypes[0]!
  } else if (type.includes('.')) {
    // Check for relation (contains a dot for backref)
    isRelation = true
    const [entityName, backrefName] = type.split('.')
    relatedType = entityName
    backref = backrefName
    type = entityName!
  } else if (
    type[0] === type[0]?.toUpperCase() &&
    !isPrimitiveType(type) &&
    !type.includes(' ') &&  // Type names don't have spaces - strings with spaces are prompts/descriptions
    !type.includes('|')     // Skip if it looks like a union type (will be handled above)
  ) {
    // PascalCase non-primitive = relation without explicit backref
    isRelation = true
    relatedType = type
  }

  // Build result object
  const result: ParsedField = {
    name,
    type,
    isArray,
    isOptional,
    isRelation,
    relatedType,
    backref,
  }

  // Only add operator properties if an operator was found
  if (operator) {
    result.operator = operator
    result.direction = direction
    result.matchMode = matchMode
    if (prompt) {
      result.prompt = prompt
    }
    if (operatorResult?.threshold !== undefined) {
      result.threshold = operatorResult.threshold
    }
    // Add union types if present
    if (unionTypes) {
      result.unionTypes = unionTypes
    }
  }

  return result
}

/**
 * Check if a type is a primitive
 */
function isPrimitiveType(type: string): boolean {
  const primitives: PrimitiveType[] = [
    'string',
    'number',
    'boolean',
    'date',
    'datetime',
    'json',
    'markdown',
    'url',
  ]
  return primitives.includes(type as PrimitiveType)
}

/**
 * Parse a database schema and resolve bi-directional relationships
 */
export function parseSchema(schema: DatabaseSchema): ParsedSchema {
  const entities = new Map<string, ParsedEntity>()

  // First pass: parse all entities and their fields
  for (const [entityName, entitySchema] of Object.entries(schema)) {
    const fields = new Map<string, ParsedField>()

    for (const [fieldName, fieldDef] of Object.entries(entitySchema)) {
      // Skip metadata fields (prefixed with $) like $fuzzyThreshold, $instructions
      if (fieldName.startsWith('$')) {
        continue
      }
      // Skip non-string/array definitions (invalid field types)
      if (typeof fieldDef !== 'string' && !Array.isArray(fieldDef)) {
        continue
      }
      fields.set(fieldName, parseField(fieldName, fieldDef))
    }

    // Store raw schema for accessing metadata like $fuzzyThreshold
    entities.set(entityName, { name: entityName, fields, schema: entitySchema })
  }

  // Validation pass: check that all operator-based references (->, ~>, <-, <~) point to existing types
  // For implicit backrefs (Author.posts), we silently skip if the type doesn't exist
  // Note: Union types are NOT validated here - they are validated in DB() to allow parseSchema()
  // to be used for pure parsing tests without requiring all union types to be defined
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.operator) {
        // Only validate fields with explicit operators
        // Skip self-references (valid)
        if (field.relatedType === entityName) continue

        // Skip union types - they are validated in DB() instead
        if (field.unionTypes && field.unionTypes.length > 0) {
          continue
        }

        // Check if referenced type exists (non-union case)
        if (!entities.has(field.relatedType)) {
          throw new Error(
            `Invalid schema: ${entityName}.${fieldName} references non-existent type '${field.relatedType}'`
          )
        }
      }
    }
  }

  // Second pass: create bi-directional relationships
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.backref) {
        const relatedEntity = entities.get(field.relatedType)
        if (relatedEntity && !relatedEntity.fields.has(field.backref)) {
          // Auto-create the inverse relation
          // If Post.author -> Author.posts, then Author.posts -> Post[]
          relatedEntity.fields.set(field.backref, {
            name: field.backref,
            type: entityName,
            isArray: true, // Backref is always an array
            isOptional: false,
            isRelation: true,
            relatedType: entityName,
            backref: fieldName, // Points back to the original field
          })
        }
      }
    }
  }

  return { entities }
}

// =============================================================================
// Type Generation (for TypeScript inference)
// =============================================================================

/**
 * Map field type to TypeScript type
 */
type FieldToTS<T extends string> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'date' | 'datetime'
        ? Date
        : T extends 'json'
          ? Record<string, unknown>
          : T extends 'markdown'
            ? string
            : T extends 'url'
              ? string
              : unknown

/**
 * Infer entity type from schema definition
 */
export type InferEntity<
  TSchema extends DatabaseSchema,
  TEntity extends keyof TSchema,
> = {
  $id: string
  $type: TEntity
} & {
  [K in keyof TSchema[TEntity]]: TSchema[TEntity][K] extends `${infer Type}.${string}`
    ? Type extends keyof TSchema
      ? InferEntity<TSchema, Type>
      : unknown
    : TSchema[TEntity][K] extends `${infer Type}[]`
      ? Type extends keyof TSchema
        ? InferEntity<TSchema, Type>[]
        : FieldToTS<Type>[]
      : TSchema[TEntity][K] extends `${infer Type}?`
        ? FieldToTS<Type> | undefined
        : FieldToTS<TSchema[TEntity][K] & string>
}

// =============================================================================
// Typed Operations
// =============================================================================

/**
 * Operations available on each entity type
 */
export interface EntityOperations<T> {
  /** Get an entity by ID */
  get(id: string): Promise<T | null>

  /** List all entities */
  list(options?: ListOptions): Promise<T[]>

  /** Find entities matching criteria */
  find(where: Partial<T>): Promise<T[]>

  /** Search entities */
  search(query: string, options?: SearchOptions): Promise<T[]>

  /** Create a new entity */
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Update an entity */
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>

  /** Upsert an entity */
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Delete an entity */
  delete(id: string): Promise<boolean>

  /** Iterate over entities */
  forEach(callback: (entity: T) => void | Promise<void>): Promise<void>
  forEach(
    options: ListOptions,
    callback: (entity: T) => void | Promise<void>
  ): Promise<void>

  /** Semantic search */
  semanticSearch?(query: string, options?: SemanticSearchOptions): Promise<Array<T & { $score: number }>>

  /** Hybrid search */
  hybridSearch?(query: string, options?: HybridSearchOptions): Promise<Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>>

  /** Create draft entity */
  draft?(data: Partial<Omit<T, '$id' | '$type'>>, options?: DraftOptions): Promise<Draft<T>>

  /** Resolve draft entity */
  resolve?(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>>
}

/**
 * Operations with promise pipelining support
 *
 * Query methods return DBPromise for chainable operations:
 * - `.map()` with batch optimization
 * - `.filter()`, `.sort()`, `.limit()`
 * - Property access tracking for projections
 *
 * @example
 * ```ts
 * // Chain without await
 * const leads = db.Lead.list()
 * const qualified = await leads
 *   .filter(l => l.score > 80)
 *   .map(l => ({ name: l.name, company: l.company }))
 *
 * // Batch relationship loading
 * const orders = await db.Order.list().map(o => ({
 *   order: o,
 *   customer: o.customer,  // Batch loaded!
 * }))
 * ```
 */
export interface PipelineEntityOperations<T> {
  /** Get an entity by ID */
  get(id: string): DBPromise<T | null>

  /** List all entities */
  list(options?: ListOptions): DBPromise<T[]>

  /** Find entities matching criteria */
  find(where: Partial<T>): DBPromise<T[]>

  /** Search entities */
  search(query: string, options?: SearchOptions): DBPromise<T[]>

  /** Get first matching entity */
  first(): DBPromise<T | null>

  /** Create a new entity */
  create(data: Omit<T, '$id' | '$type'>, options?: CreateEntityOptions): Promise<T | Draft<T>>
  create(id: string, data: Omit<T, '$id' | '$type'>, options?: CreateEntityOptions): Promise<T | Draft<T>>

  /**
   * Create a draft entity with natural language placeholders for references
   *
   * The draft phase generates entity content but leaves relationship fields
   * as natural language descriptions that will be resolved later.
   *
   * @example
   * ```ts
   * const draft = await db.Startup.draft({ name: 'Acme' })
   * // draft.idea contains natural language like "A revolutionary SaaS idea"
   * // draft.$refs.idea contains reference spec for resolution
   * ```
   */
  draft(data: Partial<Omit<T, '$id' | '$type'>>, options?: DraftOptions): Promise<Draft<T>>

  /**
   * Resolve a draft entity by converting natural language references to entity IDs
   *
   * The resolve phase creates or matches related entities and replaces
   * natural language placeholders with actual entity IDs.
   *
   * @example
   * ```ts
   * const draft = await db.Startup.draft({ name: 'Acme' })
   * const resolved = await db.Startup.resolve(draft)
   * // resolved.idea is now an actual entity ID
   * ```
   */
  resolve(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>>

  /** Update an entity */
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>

  /** Upsert an entity */
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Delete an entity */
  delete(id: string): Promise<boolean>

  /**
   * Process each entity with concurrency control, progress tracking, and error handling
   *
   * Designed for large-scale operations like AI generations or workflows.
   *
   * @example
   * ```ts
   * // Simple iteration
   * await db.Lead.forEach(lead => console.log(lead.name))
   *
   * // With AI and concurrency
   * const result = await db.Lead.forEach(async lead => {
   *   const analysis = await ai`analyze ${lead}`
   *   await db.Lead.update(lead.$id, { analysis })
   * }, {
   *   concurrency: 10,
   *   onProgress: p => console.log(`${p.completed}/${p.total}`),
   * })
   *
   * // With error handling
   * await db.Order.forEach(async order => {
   *   await sendInvoice(order)
   * }, {
   *   maxRetries: 3,
   *   onError: (err, order) => err.code === 'RATE_LIMIT' ? 'retry' : 'continue',
   * })
   * ```
   */
  forEach<U>(
    callback: (entity: T, index: number) => U | Promise<U>,
    options?: ForEachOptions<T>
  ): Promise<ForEachResult>

  /**
   * Semantic search using embedding similarity
   *
   * @example
   * ```ts
   * const results = await db.Document.semanticSearch('deep learning neural networks')
   * // Returns documents with $score field sorted by similarity
   * ```
   */
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<Array<T & { $score: number }>>

  /**
   * Hybrid search combining FTS and semantic search with RRF scoring
   *
   * @example
   * ```ts
   * const results = await db.Post.hybridSearch('React useState')
   * // Returns posts with $rrfScore, $ftsRank, $semanticRank fields
   * ```
   */
  hybridSearch(query: string, options?: HybridSearchOptions): Promise<Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>>
}

export interface ListOptions {
  where?: Record<string, unknown>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
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

// EmbeddingsConfig is imported from semantic.ts

/**
 * DB Options for configuring embeddings and other settings
 */
export interface DBOptions {
  /** Embedding configuration per type */
  embeddings?: EmbeddingsConfig
}

// =============================================================================
// Database Client Type
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
 *
 * @example
 * ```ts
 * // Query across all types
 * const results = await db`what is happening with joe in ca?`
 *
 * // Query specific type
 * const orders = await db.Orders`what pending orders are delayed?`
 *
 * // With interpolation
 * const name = 'joe'
 * const results = await db`find all orders for ${name}`
 * ```
 */
export type NLQueryFn<T = unknown> = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<NLQueryResult<T>>

/**
 * Typed database client based on schema
 *
 * Entity operations return DBPromise for chainable queries:
 * ```ts
 * const { db } = DB({ Lead: { name: 'string', company: 'Company.leads' } })
 *
 * // Chain without await
 * const leads = db.Lead.list()
 * const qualified = await leads.filter(l => l.score > 80)
 *
 * // Batch relationship loading
 * const withCompanies = await leads.map(l => ({
 *   lead: l,
 *   company: l.company,  // Batch loaded!
 * }))
 * ```
 */
export type TypedDB<TSchema extends DatabaseSchema> = {
  [K in keyof TSchema]: PipelineEntityOperations<InferEntity<TSchema, K>> & NLQueryFn<InferEntity<TSchema, K>>
} & {
  /** The parsed schema */
  readonly $schema: ParsedSchema

  /** Get any entity by URL */
  get(url: string): Promise<unknown>

  /** Search across all entities */
  search(query: string, options?: SearchOptions): Promise<unknown[]>

  /** Count entities of a type */
  count(type: string, where?: Record<string, unknown>): Promise<number>

  /** Iterate over entities with a callback */
  forEach(
    options: { type: string; where?: Record<string, unknown>; concurrency?: number },
    callback: (entity: unknown) => void | Promise<void>
  ): Promise<void>

  /** Set entity data by ID (creates or replaces) */
  set(type: string, id: string, data: Record<string, unknown>): Promise<unknown>

  /** Generate entities using AI */
  generate(options: GenerateOptions): Promise<unknown | { id: string }>

  /**
   * Natural language query across all types
   *
   * @example
   * ```ts
   * const results = await db`what orders are pending for customers in california?`
   * const results = await db`show me joe's recent activity`
   * const results = await db`what changed in the last hour?`
   * ```
   */
  ask: NLQueryFn

  /**
   * Global semantic search across all entity types
   *
   * @example
   * ```ts
   * const results = await db.semanticSearch('artificial intelligence')
   * // Returns results from all types with $type and $score fields
   * ```
   */
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<Array<{ $id: string; $type: string; $score: number; [key: string]: unknown }>>

  /**
   * Subscribe to database events (draft, resolve, create, update, delete)
   *
   * @example
   * ```ts
   * db.on('draft', (entity) => console.log('Draft created:', entity.$type))
   * db.on('resolve', (entity) => console.log('Entity resolved:', entity.$type))
   * db.on('Post.created', (event) => console.log('Post created'))
   * ```
   */
  on(event: string, handler: (data: unknown) => void): () => void
}

/**
 * Options for AI-powered entity generation
 */
export interface GenerateOptions {
  type: string
  count?: number
  data?: Record<string, unknown>
  mode?: 'sync' | 'background'
}

// =============================================================================
// Events API (Actor-Event-Object-Result pattern)
// =============================================================================

/**
 * Actor data - who performed the action
 *
 * @example
 * ```ts
 * const actorData: ActorData = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   org: 'Acme Corp',
 *   role: 'admin',
 * }
 * ```
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
 *
 * Following ActivityStreams semantics:
 * - Actor: Who did it (user, system, agent)
 * - Event: What happened (created, updated, published)
 * - Object: What it was done to (the entity)
 * - Result: What was the outcome (optional)
 *
 * @example
 * ```ts
 * const event: DBEvent = {
 *   id: '01HGXYZ...',
 *   actor: 'user:john',
 *   actorData: { name: 'John Doe', email: 'john@example.com' },
 *   event: 'Post.published',
 *   object: 'https://example.com/Post/hello-world',
 *   objectData: { title: 'Hello World' },
 *   result: 'https://example.com/Publication/123',
 *   resultData: { url: 'https://blog.example.com/hello-world' },
 *   timestamp: new Date(),
 * }
 * ```
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

  // Legacy compatibility (deprecated)
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

// =============================================================================
// Actions API (Linguistic Verb Pattern)
// =============================================================================

/**
 * Action data structure for durable execution
 *
 * Uses linguistic verb conjugations for semantic clarity:
 * - act: Present tense 3rd person (creates, publishes)
 * - action: Base verb form (create, publish)
 * - activity: Gerund/progressive (creating, publishing)
 *
 * @example
 * ```ts
 * const action: DBAction = {
 *   id: '01HGXYZ...',
 *   actor: 'user:john',
 *   actorData: { name: 'John Doe' },
 *   // Verb conjugations
 *   act: 'generates',        // Present tense: "system generates posts"
 *   action: 'generate',      // Base form for lookups
 *   activity: 'generating',  // Progressive: "currently generating posts"
 *   // Target
 *   object: 'Post',
 *   objectData: { count: 100 },
 *   // Status
 *   status: 'active',
 *   progress: 50,
 *   total: 100,
 *   // Result
 *   result: { created: 50 },
 *   timestamp: new Date(),
 * }
 * ```
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

  // Legacy compatibility (deprecated)
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

  // Legacy compatibility
  /** @deprecated Use 'action' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

/**
 * Actions API for durable execution tracking
 *
 * @example
 * ```ts
 * // Create an action with verb conjugation
 * const action = await actions.create({
 *   actor: 'system',
 *   action: 'generate',  // auto-conjugates to act='generates', activity='generating'
 *   object: 'Post',
 *   objectData: { count: 100 },
 *   total: 100,
 * })
 *
 * // Update progress
 * await actions.update(action.id, { progress: 50 })
 *
 * // Complete with result
 * await actions.update(action.id, {
 *   status: 'completed',
 *   result: { created: 100 },
 * })
 * ```
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

// =============================================================================
// Artifacts API
// =============================================================================

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

// =============================================================================
// Nouns API
// =============================================================================

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

// =============================================================================
// Verbs API
// =============================================================================

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
// DB Result Type
// =============================================================================

/**
 * Result of DB() factory - supports both direct and destructured usage
 *
 * @example
 * ```ts
 * // Direct usage - everything on one object
 * const db = DB(schema)
 * db.User.create(...)      // entity operations
 * db.events.on(...)        // events API
 * db.actions.create(...)   // actions API
 *
 * // Destructured usage - cleaner separation
 * const { db, events, actions } = DB(schema)
 * db.User.create(...)      // just entity ops
 * events.on(...)           // separate events
 * ```
 */
export type DBResult<TSchema extends DatabaseSchema> = TypedDB<TSchema> & {
  /** Self-reference for destructuring - same as the parent object but cleaner semantically */
  db: TypedDB<TSchema>

  /** Event subscription and emission */
  events: EventsAPI

  /** Durable action execution */
  actions: ActionsAPI

  /** Cached embeddings and computed content */
  artifacts: ArtifactsAPI

  /** Type introspection */
  nouns: NounsAPI

  /** Action introspection */
  verbs: VerbsAPI
}

// =============================================================================
// Natural Language Query Implementation
// =============================================================================

/**
 * AI generator function type for NL queries
 * This is injected by the user or resolved from environment
 */
export type NLQueryGenerator = (prompt: string, context: NLQueryContext) => Promise<NLQueryPlan>

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

let nlQueryGenerator: NLQueryGenerator | null = null

/**
 * Set the AI generator for natural language queries
 *
 * @example
 * ```ts
 * import { generate } from 'ai-functions'
 *
 * setNLQueryGenerator(async (prompt, context) => {
 *   return generate({
 *     prompt: `Given this schema: ${JSON.stringify(context.types)}
 *              Answer this question: ${prompt}
 *              Return a query plan as JSON.`,
 *     schema: NLQueryPlanSchema
 *   })
 * })
 * ```
 */
export function setNLQueryGenerator(generator: NLQueryGenerator): void {
  nlQueryGenerator = generator
}

/**
 * Build schema context for NL queries
 */
function buildNLQueryContext(schema: ParsedSchema, targetType?: string): NLQueryContext {
  const types: NLQueryContext['types'] = []

  for (const [name, entity] of schema.entities) {
    const fields: string[] = []
    const relationships: NLQueryContext['types'][0]['relationships'] = []

    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType) {
        relationships.push({
          name: fieldName,
          to: field.relatedType,
          cardinality: field.isArray ? 'many' : 'one',
        })
      } else {
        fields.push(fieldName)
      }
    }

    const meta = getTypeMeta(name)
    types.push({
      name,
      singular: meta.singular,
      plural: meta.plural,
      fields,
      relationships,
    })
  }

  return { types, targetType }
}

/**
 * Execute a natural language query
 */
async function executeNLQuery<T>(
  question: string,
  schema: ParsedSchema,
  targetType?: string
): Promise<NLQueryResult<T>> {
  // If no AI generator configured, fall back to search
  if (!nlQueryGenerator) {
    // Simple fallback: search across all types or target type
    const provider = await resolveProvider()
    const results: T[] = []

    if (targetType) {
      const searchResults = await provider.search(targetType, question)
      results.push(...(searchResults as T[]))
    } else {
      for (const [typeName] of schema.entities) {
        const searchResults = await provider.search(typeName, question)
        results.push(...(searchResults as T[]))
      }
    }

    return {
      interpretation: `Search for "${question}"`,
      confidence: 0.5,
      results,
      explanation: 'Fallback to keyword search (no AI generator configured)',
    }
  }

  // Build context and get AI-generated query plan
  const context = buildNLQueryContext(schema, targetType)
  const plan = await nlQueryGenerator(question, context)

  // Execute the plan
  const provider = await resolveProvider()
  const results: T[] = []

  for (const typeName of plan.types) {
    let typeResults: Record<string, unknown>[]

    if (plan.search) {
      typeResults = await provider.search(typeName, plan.search, {
        where: plan.filters,
      })
    } else {
      typeResults = await provider.list(typeName, {
        where: plan.filters,
      })
    }

    results.push(...(typeResults as T[]))
  }

  return {
    interpretation: plan.interpretation,
    confidence: plan.confidence,
    results,
    query: JSON.stringify({ types: plan.types, filters: plan.filters, search: plan.search }),
  }
}

/**
 * Create a natural language query function for a specific type
 */
function createNLQueryFn<T>(
  schema: ParsedSchema,
  typeName?: string
): NLQueryFn<T> {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Interpolate the template
    const question = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? String(values[i]) : '')
    }, '')

    return executeNLQuery<T>(question, schema, typeName)
  }
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Database provider interface that adapters must implement
 */
export interface DBProvider {
  /** Get an entity */
  get(type: string, id: string): Promise<Record<string, unknown> | null>

  /** List entities */
  list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]>

  /** Search entities */
  search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]>

  /** Create an entity */
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Update an entity */
  update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Delete an entity */
  delete(type: string, id: string): Promise<boolean>

  /** Get related entities */
  related(
    type: string,
    id: string,
    relation: string
  ): Promise<Record<string, unknown>[]>

  /** Create a relationship */
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number }
  ): Promise<void>

  /** Remove a relationship */
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
}

// =============================================================================
// Provider Resolution
// =============================================================================

let globalProvider: DBProvider | null = null
let providerPromise: Promise<DBProvider> | null = null

/** File count threshold for suggesting ClickHouse upgrade */
const FILE_COUNT_THRESHOLD = 10_000

/**
 * Set the global database provider
 */
export function setProvider(provider: DBProvider): void {
  globalProvider = provider
  providerPromise = null
}

/**
 * Parsed DATABASE_URL
 */
interface ParsedDatabaseUrl {
  provider: 'fs' | 'sqlite' | 'clickhouse' | 'memory'
  /** Content root directory */
  root: string
  /** Remote URL for Turso/ClickHouse HTTP */
  remoteUrl?: string
}

/**
 * Parse DATABASE_URL into provider type and paths
 *
 * Local storage (all use .db/ folder):
 * - `./content` → fs (default)
 * - `sqlite://./content` → sqlite stored in ./content/.db/index.sqlite
 * - `chdb://./content` → clickhouse stored in ./content/.db/clickhouse/
 *
 * Remote:
 * - `libsql://your-db.turso.io` → Turso SQLite
 * - `clickhouse://host:8123` → ClickHouse HTTP
 * - `:memory:` → in-memory
 */
function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) return { provider: 'fs', root: './content' }

  // In-memory
  if (url === ':memory:') {
    return { provider: 'memory', root: '' }
  }

  // Remote Turso
  if (url.startsWith('libsql://') || url.includes('.turso.io')) {
    return { provider: 'sqlite', root: '', remoteUrl: url }
  }

  // Remote ClickHouse
  if (url.startsWith('clickhouse://') && url.includes(':')) {
    // clickhouse://host:port/db
    return { provider: 'clickhouse', root: '', remoteUrl: url.replace('clickhouse://', 'https://') }
  }

  // Local SQLite: sqlite://./content → ./content/.db/index.sqlite
  if (url.startsWith('sqlite://')) {
    const root = url.replace('sqlite://', '') || './content'
    return { provider: 'sqlite', root }
  }

  // Local ClickHouse (chDB): chdb://./content → ./content/.db/clickhouse/
  if (url.startsWith('chdb://')) {
    const root = url.replace('chdb://', '') || './content'
    return { provider: 'clickhouse', root }
  }

  // Default: filesystem
  return { provider: 'fs', root: url }
}

/**
 * Resolve provider from DATABASE_URL environment variable
 *
 * @example
 * ```bash
 * # Filesystem (default) - stores in ./content with .db/ metadata
 * DATABASE_URL=./content
 *
 * # Local SQLite - stores in ./content/.db/index.sqlite
 * DATABASE_URL=sqlite://./content
 *
 * # Remote Turso
 * DATABASE_URL=libsql://your-db.turso.io
 *
 * # Local ClickHouse (chDB) - stores in ./content/.db/clickhouse/
 * DATABASE_URL=chdb://./content
 *
 * # Remote ClickHouse
 * DATABASE_URL=clickhouse://localhost:8123
 *
 * # In-memory (testing)
 * DATABASE_URL=:memory:
 * ```
 */
async function resolveProvider(): Promise<DBProvider> {
  if (globalProvider) return globalProvider

  if (providerPromise) return providerPromise

  providerPromise = (async () => {
    const databaseUrl =
      (typeof process !== 'undefined' && process.env?.DATABASE_URL) || './content'

    const parsed = parseDatabaseUrl(databaseUrl)

    switch (parsed.provider) {
      case 'memory': {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
        break
      }

      case 'fs': {
        try {
          const { createFsProvider } = await import('@mdxdb/fs' as any)
          globalProvider = createFsProvider({ root: parsed.root })

          // Check file count and warn if approaching threshold
          checkFileCountThreshold(parsed.root)
        } catch (err) {
          console.warn('@mdxdb/fs not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'sqlite': {
        try {
          const { createSqliteProvider } = await import('@mdxdb/sqlite' as any)

          if (parsed.remoteUrl) {
            // Remote Turso
            globalProvider = await createSqliteProvider({ url: parsed.remoteUrl })
          } else {
            // Local SQLite in .db folder
            const dbPath = `${parsed.root}/.db/index.sqlite`
            globalProvider = await createSqliteProvider({ url: `file:${dbPath}` })
          }
        } catch (err) {
          console.warn('@mdxdb/sqlite not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'clickhouse': {
        try {
          const { createClickhouseProvider } = await import('@mdxdb/clickhouse' as any)

          if (parsed.remoteUrl) {
            // Remote ClickHouse
            globalProvider = await createClickhouseProvider({
              mode: 'http',
              url: parsed.remoteUrl,
            })
          } else {
            // Local chDB in .db folder
            const dbPath = `${parsed.root}/.db/clickhouse`
            globalProvider = await createClickhouseProvider({
              mode: 'chdb',
              url: dbPath,
            })
          }
        } catch (err) {
          console.warn('@mdxdb/clickhouse not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      default: {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
      }
    }

    return globalProvider!
  })()

  return providerPromise
}

/**
 * Check file count and warn if approaching threshold
 */
async function checkFileCountThreshold(root: string): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function countFiles(dir: string): Promise<number> {
      let count = 0
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (entry.isDirectory()) {
            count += await countFiles(path.join(dir, entry.name))
          } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
            count++
          }
        }
      } catch {
        // Directory doesn't exist yet
      }
      return count
    }

    const count = await countFiles(root)
    if (count > FILE_COUNT_THRESHOLD) {
      console.warn(
        `\n⚠️  You have ${count.toLocaleString()} MDX files. ` +
        `Consider upgrading to ClickHouse for better performance:\n` +
        `   DATABASE_URL=chdb://./data/clickhouse\n`
      )
    }
  } catch {
    // Ignore errors in file counting
  }
}

// =============================================================================
// Edge Entity Operations
// =============================================================================

/**
 * Create entity operations for the Edge system type
 *
 * Edge records are stored in memory from the schema parsing,
 * not in the provider. This ensures edges are immediately queryable.
 *
 * Also queries runtime Edge records from the provider for fuzzy match metadata.
 */
function createEdgeEntityOperations(
  schemaEdgeRecords: Array<Record<string, unknown>>,
  getProvider: () => Promise<DBProvider>
): EntityOperations<Record<string, unknown>> {
  /**
   * Get runtime Edge records from the provider
   */
  async function getRuntimeEdges(): Promise<Array<Record<string, unknown>>> {
    try {
      const provider = await getProvider()
      const runtimeEdges = await provider.list('Edge')
      return runtimeEdges
    } catch {
      return []
    }
  }

  /**
   * Get all edges (schema + runtime), with runtime taking precedence
   * For fuzzy edges, only return runtime edges (they have similarity scores)
   */
  async function getAllEdges(): Promise<Array<Record<string, unknown>>> {
    const runtimeEdges = await getRuntimeEdges()

    // Create a set of runtime edge keys (from:name) to filter duplicates
    const runtimeEdgeKeys = new Set(
      runtimeEdges.map(e => `${e.from}:${e.name}`)
    )

    // For schema edges, only include those without a runtime counterpart
    // (runtime edges have more specific info like similarity scores)
    const filteredSchemaEdges = schemaEdgeRecords.filter(e => {
      const key = `${e.from}:${e.name}`
      // If there's a runtime edge with the same from:name, skip the schema edge
      // unless the schema edge is of type 'exact' and runtime is 'fuzzy'
      const hasRuntimeVersion = runtimeEdgeKeys.has(key)
      if (hasRuntimeVersion && e.matchMode === 'fuzzy') {
        return false // Skip schema fuzzy edge, use runtime version instead
      }
      return !hasRuntimeVersion
    })

    return [...filteredSchemaEdges, ...runtimeEdges]
  }

  return {
    async get(id: string) {
      // Check runtime edges first (they have more specific info)
      const runtimeEdges = await getRuntimeEdges()
      const runtimeMatch = runtimeEdges.find(e => e.$id === id || `${e.from}:${e.name}` === id)
      if (runtimeMatch) return { ...runtimeMatch, $type: 'Edge' }

      // Fall back to schema edges
      return schemaEdgeRecords.find(e => `${e.from}:${e.name}` === id) ?? null
    },

    async list(options?: ListOptions) {
      let results = await getAllEdges()

      // Apply where filter
      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          results = results.filter(e => e[key] === value)
        }
      }

      // Add $id and $type
      return results.map(e => ({
        ...e,
        $id: e.$id || `${e.from}:${e.name}`,
        $type: 'Edge',
      }))
    },

    async find(where: Record<string, unknown>) {
      let results = await getAllEdges()

      for (const [key, value] of Object.entries(where)) {
        results = results.filter(e => e[key] === value)
      }

      return results.map(e => ({
        ...e,
        $id: e.$id || `${e.from}:${e.name}`,
        $type: 'Edge',
      }))
    },

    async search(query: string) {
      const allEdges = await getAllEdges()
      const queryLower = query.toLowerCase()
      return allEdges
        .filter(e =>
          String(e.from).toLowerCase().includes(queryLower) ||
          String(e.name).toLowerCase().includes(queryLower) ||
          String(e.to).toLowerCase().includes(queryLower)
        )
        .map(e => ({
          ...e,
          $id: e.$id || `${e.from}:${e.name}`,
          $type: 'Edge',
        }))
    },

    async create() {
      throw new Error('Cannot manually create Edge records - they are auto-generated')
    },

    async update() {
      throw new Error('Cannot manually update Edge records - they are auto-generated')
    },

    async upsert() {
      throw new Error('Cannot manually upsert Edge records - they are auto-generated')
    },

    async delete() {
      throw new Error('Cannot manually delete Edge records - they are auto-generated')
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: Record<string, unknown>) => void | Promise<void>),
      maybeCallback?: (entity: Record<string, unknown>) => void | Promise<void>
    ) {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch() {
      return []
    },

    async hybridSearch() {
      return []
    },
  }
}

// =============================================================================
// DB Factory
// =============================================================================

/**
 * Create a typed database from a schema definition
 *
 * Supports both direct usage and destructuring for flexibility:
 *
 * @example Direct usage - everything on one object
 * ```ts
 * const db = DB({
 *   Post: { title: 'string', author: 'Author.posts' },
 *   Author: { name: 'string' },
 * })
 *
 * // Entity operations
 * const post = await db.Post.create({ title: 'Hello' })
 *
 * // Events, actions, etc. are also available directly
 * db.events.on('Post.created', (event) => console.log(event))
 * db.actions.create({ type: 'generate', data: {} })
 * ```
 *
 * @example Destructured usage - cleaner separation
 * ```ts
 * const { db, events, actions, artifacts, nouns, verbs } = DB({
 *   Post: { title: 'string', author: 'Author.posts' },
 *   Author: { name: 'string' },
 * })
 *
 * // CRUD operations on db
 * const post = await db.Post.create({ title: 'Hello' })
 * await db.Post.update(post.$id, { title: 'Updated' })
 *
 * // Separate events API
 * events.on('Post.created', (event) => console.log(event))
 *
 * // Separate actions API
 * const action = await actions.create({ type: 'generate', data: {} })
 * ```
 */
export function DB<TSchema extends DatabaseSchema>(
  schema: TSchema,
  options?: DBOptions
): DBResult<TSchema> {
  const parsedSchema = parseSchema(schema)

  // Validate union types - ensure all union type references point to existing types
  // This is done here rather than in parseSchema() to allow parseSchema() to be used
  // for pure parsing tests without requiring all union types to be defined
  for (const [entityName, entity] of parsedSchema.entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.operator && field.unionTypes && field.unionTypes.length > 0) {
        for (const unionType of field.unionTypes) {
          if (unionType === entityName) continue // Skip self-references
          if (!parsedSchema.entities.has(unionType)) {
            throw new Error(
              `Invalid schema: ${entityName}.${fieldName} references non-existent type '${unionType}'`
            )
          }
        }
      }
    }
  }

  // Add Edge entity to the parsed schema for querying edge metadata
  const edgeEntity: ParsedEntity = {
    name: 'Edge',
    fields: new Map([
      ['from', { name: 'from', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      ['name', { name: 'name', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      ['to', { name: 'to', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      ['backref', { name: 'backref', type: 'string', isArray: false, isOptional: true, isRelation: false }],
      ['cardinality', { name: 'cardinality', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      ['direction', { name: 'direction', type: 'string', isArray: false, isOptional: false, isRelation: false }],
      ['matchMode', { name: 'matchMode', type: 'string', isArray: false, isOptional: true, isRelation: false }],
    ]),
  }
  parsedSchema.entities.set('Edge', edgeEntity)

  // Configure provider with embeddings settings if provided
  if (options?.embeddings) {
    resolveProvider().then(provider => {
      if ('setEmbeddingsConfig' in provider) {
        (provider as any).setEmbeddingsConfig(options.embeddings)
      }
    })
  }

  // Collect all edge records from the schema
  const allEdgeRecords: Array<Record<string, unknown>> = []
  for (const [entityName, entity] of parsedSchema.entities) {
    if (entityName !== 'Edge') {
      const edgeRecords = createEdgeRecords(entityName, schema[entityName] ?? {}, entity)
      allEdgeRecords.push(...edgeRecords)
    }
  }

  // Create Actions API early so it can be injected into entity operations
  const actionsAPI = {
    async create(options: CreateActionOptions | { type: string; data: unknown; total?: number }) {
      const provider = await resolveProvider()
      if ('createAction' in provider) {
        return (provider as any).createAction(options)
      }
      throw new Error('Provider does not support actions')
    },
    async get(id: string) {
      const provider = await resolveProvider()
      if ('getAction' in provider) {
        return (provider as any).getAction(id)
      }
      return null
    },
    async update(id: string, updates: unknown) {
      const provider = await resolveProvider()
      if ('updateAction' in provider) {
        return (provider as any).updateAction(id, updates)
      }
      throw new Error('Provider does not support actions')
    },
  }

  // Create entity operations for each type with promise pipelining
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityOperations: Record<string, any> = {}

  // Internal event emitter for draft/resolve events (defined early for use in entity operations)
  const eventHandlersForOps = new Map<string, Set<(data: unknown) => void>>()

  function emitInternalEventForOps(eventType: string, data: unknown): void {
    const handlers = eventHandlersForOps.get(eventType)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (e) {
          console.error(`Error in event handler for ${eventType}:`, e)
        }
      }
    }
  }

  for (const [entityName, entity] of parsedSchema.entities) {
    if (entityName === 'Edge') {
      // Special handling for Edge entity - query from in-memory edge records + runtime edges
      const edgeOps = createEdgeEntityOperations(allEdgeRecords, resolveProvider)
      entityOperations[entityName] = wrapEntityOperations(entityName, edgeOps, actionsAPI)
    } else {
      const baseOps = createEntityOperations(entityName, entity, parsedSchema)
      // Wrap with DBPromise for chainable queries, inject actions for forEach persistence
      const wrappedOps = wrapEntityOperations(entityName, baseOps, actionsAPI)

      // Add draft and resolve with event emission
      const draftFn = async (data: Record<string, unknown>, options?: DraftOptions): Promise<unknown> => {
        const draft = await (baseOps as any).draft(data, options)
        draft.$type = entityName
        emitInternalEventForOps('draft', draft)
        return draft
      }
      wrappedOps.draft = draftFn

      const resolveFn = async (draft: unknown, options?: ResolveOptions): Promise<unknown> => {
        const resolved = await (baseOps as any).resolve(draft, options)
        if (resolved && typeof resolved === 'object') {
          (resolved as Record<string, unknown>).$type = entityName
        }
        emitInternalEventForOps('resolve', resolved)
        return resolved
      }
      wrappedOps.resolve = resolveFn

      // Update create to support draftOnly option
      const originalCreate = wrappedOps.create
      wrappedOps.create = async (...args: unknown[]): Promise<unknown> => {
        // Parse arguments - can be (data, options?) or (id, data, options?)
        let data: Record<string, unknown>
        let options: CreateEntityOptions | undefined

        if (typeof args[0] === 'string') {
          // (id, data, options?)
          data = args[1] as Record<string, unknown>
          options = args[2] as CreateEntityOptions | undefined
        } else {
          // (data, options?)
          data = args[0] as Record<string, unknown>
          options = args[1] as CreateEntityOptions | undefined
        }

        if (options?.draftOnly) {
          const draft = await draftFn(data)
          return draft
        }

        // Run draft phase first
        const draft = await draftFn(data) as Record<string, unknown>
        // Then resolve
        const resolved = await resolveFn(draft) as Record<string, unknown>
        // Create the final entity (without phase markers)
        const finalData = { ...(resolved || {}) }
        delete finalData.$phase
        delete finalData.$refs
        delete finalData.$errors
        delete finalData.$type

        return originalCreate.call(wrappedOps, ...args)
      }

      entityOperations[entityName] = wrappedOps
    }
  }

  // Noun definitions cache
  const nounDefinitions = new Map<string, Noun>()

  // Initialize nouns from schema
  for (const [entityName] of parsedSchema.entities) {
    const noun = inferNoun(entityName)
    nounDefinitions.set(entityName, noun)
  }

  // Verb definitions cache
  const verbDefinitions = new Map<string, Verb>(
    Object.entries(Verbs).map(([k, v]) => [k, v])
  )

  // Use the event handlers defined earlier for entity operations
  function onInternal(eventType: string, handler: (data: unknown) => void): () => void {
    if (!eventHandlersForOps.has(eventType)) {
      eventHandlersForOps.set(eventType, new Set())
    }
    eventHandlersForOps.get(eventType)!.add(handler)
    return () => {
      eventHandlersForOps.get(eventType)?.delete(handler)
    }
  }

  // Create the typed DB object
  const db = {
    $schema: parsedSchema,

    async get(url: string) {
      const provider = await resolveProvider()
      const parsed = parseUrl(url)
      return provider.get(parsed.type, parsed.id)
    },

    async search(query: string, options?: SearchOptions) {
      const provider = await resolveProvider()
      const results: unknown[] = []
      for (const [typeName] of parsedSchema.entities) {
        const typeResults = await provider.search(typeName, query, options)
        results.push(...typeResults)
      }
      return results
    },

    async semanticSearch(query: string, options?: SemanticSearchOptions) {
      const provider = await resolveProvider()
      const results: Array<{ $id: string; $type: string; $score: number; [key: string]: unknown }> = []

      if ('semanticSearch' in provider) {
        for (const [typeName] of parsedSchema.entities) {
          const typeResults = await (provider as any).semanticSearch(typeName, query, options)
          results.push(...typeResults)
        }
      }

      // Sort by score across all types
      results.sort((a, b) => b.$score - a.$score)

      // Apply limit if specified
      const limit = options?.limit ?? results.length
      return results.slice(0, limit)
    },

    async count(type: string, where?: Record<string, unknown>) {
      const provider = await resolveProvider()
      const results = await provider.list(type, { where })
      return results.length
    },

    async forEach(
      options: { type: string; where?: Record<string, unknown>; concurrency?: number },
      callback: (entity: unknown) => void | Promise<void>
    ) {
      const provider = await resolveProvider()
      const results = await provider.list(options.type, { where: options.where })
      const concurrency = options.concurrency ?? 1

      if (concurrency === 1) {
        for (const entity of results) {
          await callback(entity)
        }
      } else {
        // Process in batches with concurrency
        const { Semaphore } = await import('./memory-provider.js')
        const semaphore = new Semaphore(concurrency)
        await semaphore.map(results, callback as (item: Record<string, unknown>) => Promise<void>)
      }
    },

    async set(type: string, id: string, data: Record<string, unknown>) {
      const provider = await resolveProvider()
      const existing = await provider.get(type, id)
      if (existing) {
        // Replace entirely (not merge)
        return provider.update(type, id, data)
      }
      return provider.create(type, id, data)
    },

    async generate(options: GenerateOptions) {
      // Placeholder - actual AI generation would be implemented here
      // For now, just create with provided data
      const provider = await resolveProvider()
      if (options.mode === 'background') {
        // Return action ID for tracking
        const { createMemoryProvider } = await import('./memory-provider.js')
        const memProvider = provider as ReturnType<typeof createMemoryProvider>
        if ('createAction' in memProvider) {
          return memProvider.createAction({
            type: 'generate',
            data: options,
            total: options.count ?? 1,
          })
        }
      }
      // Sync mode - create single entity
      return provider.create(options.type, undefined, options.data ?? {})
    },

    ask: createNLQueryFn(parsedSchema),

    on: onInternal,

    ...entityOperations,
  } as TypedDB<TSchema>

  // Create Events API
  const events: EventsAPI = {
    on(pattern, handler) {
      // Get provider and delegate - need async resolution
      let unsubscribe = () => {}
      resolveProvider().then((provider) => {
        if ('on' in provider) {
          unsubscribe = (provider as any).on(pattern, handler)
        }
      })
      return () => unsubscribe()
    },

    async emit(optionsOrType: CreateEventOptions | string, data?: unknown): Promise<DBEvent> {
      const provider = await resolveProvider()
      if ('emit' in provider) {
        return (provider as any).emit(optionsOrType, data)
      }
      // Return minimal event if provider doesn't support emit
      const now = new Date()
      if (typeof optionsOrType === 'string') {
        return {
          id: crypto.randomUUID(),
          actor: 'system',
          event: optionsOrType,
          objectData: data as Record<string, unknown> | undefined,
          timestamp: now,
        }
      }
      return {
        id: crypto.randomUUID(),
        actor: optionsOrType.actor,
        actorData: optionsOrType.actorData,
        event: optionsOrType.event,
        object: optionsOrType.object,
        objectData: optionsOrType.objectData,
        result: optionsOrType.result,
        resultData: optionsOrType.resultData,
        meta: optionsOrType.meta,
        timestamp: now,
      }
    },

    async list(options) {
      const provider = await resolveProvider()
      if ('listEvents' in provider) {
        return (provider as any).listEvents(options)
      }
      return []
    },

    async replay(options) {
      const provider = await resolveProvider()
      if ('replayEvents' in provider) {
        await (provider as any).replayEvents(options)
      }
    },
  }

  // Create Actions API (extends actionsAPI with list, retry, cancel)
  const actions: ActionsAPI = {
    ...actionsAPI,

    async list(options) {
      const provider = await resolveProvider()
      if ('listActions' in provider) {
        return (provider as any).listActions(options)
      }
      return []
    },

    async retry(id) {
      const provider = await resolveProvider()
      if ('retryAction' in provider) {
        return (provider as any).retryAction(id)
      }
      throw new Error('Provider does not support actions')
    },

    async cancel(id) {
      const provider = await resolveProvider()
      if ('cancelAction' in provider) {
        await (provider as any).cancelAction(id)
      }
    },

    conjugate,
  }

  // Create Artifacts API
  const artifacts: ArtifactsAPI = {
    async get(url, type) {
      const provider = await resolveProvider()
      if ('getArtifact' in provider) {
        return (provider as any).getArtifact(url, type)
      }
      return null
    },

    async set(url, type, data) {
      const provider = await resolveProvider()
      if ('setArtifact' in provider) {
        await (provider as any).setArtifact(url, type, data)
      }
    },

    async delete(url, type) {
      const provider = await resolveProvider()
      if ('deleteArtifact' in provider) {
        await (provider as any).deleteArtifact(url, type)
      }
    },

    async list(url) {
      const provider = await resolveProvider()
      if ('listArtifacts' in provider) {
        return (provider as any).listArtifacts(url)
      }
      return []
    },
  }

  // Create Nouns API
  const nouns: NounsAPI = {
    async get(name) {
      return nounDefinitions.get(name) ?? null
    },

    async list() {
      return Array.from(nounDefinitions.values())
    },

    async define(noun) {
      nounDefinitions.set(noun.singular, noun)
    },
  }

  // Create Verbs API
  const verbs: VerbsAPI = {
    get(action) {
      return verbDefinitions.get(action) ?? null
    },

    list() {
      return Array.from(verbDefinitions.values())
    },

    define(verb) {
      verbDefinitions.set(verb.action, verb)
    },

    conjugate,
  }

  // Return combined object that supports both direct usage and destructuring
  // db.User.create() works, db.events.on() works
  // const { db, events } = DB(...) also works
  return Object.assign(db, {
    db, // self-reference for destructuring
    events,
    actions,
    artifacts,
    nouns,
    verbs,
  }) as DBResult<TSchema>
}

/**
 * Parse a URL into type and id
 */
function parseUrl(url: string): { type: string; id: string } {
  // Handle full URLs
  if (url.includes('://')) {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return {
      type: parts[0] || '',
      id: parts.slice(1).join('/'),
    }
  }

  // Handle type/id format
  if (url.includes('/')) {
    const parts = url.split('/')
    return {
      type: parts[0]!,
      id: parts.slice(1).join('/'),
    }
  }

  // Just id
  return { type: '', id: url }
}

// =============================================================================
// Forward Exact Resolution - Auto-generate related entities
// =============================================================================

/**
 * Generate an entity based on its type and context
 *
 * For testing, generates deterministic content based on the prompt and type.
 * In production, this would integrate with AI generation.
 *
 * @param type - The type of entity to generate
 * @param prompt - Optional prompt for generation context
 * @param context - Parent context information (parent type name, parentData, and optional parentId)
 * @param schema - The parsed schema
 */
async function generateEntity(
  type: string,
  prompt: string | undefined,
  context: { parent: string; parentData: Record<string, unknown>; parentId?: string },
  schema: ParsedSchema
): Promise<Record<string, unknown>> {
  const entity = schema.entities.get(type)
  if (!entity) throw new Error(`Unknown type: ${type}`)

  const data: Record<string, unknown> = {}
  for (const [fieldName, field] of entity.fields) {
    if (!field.isRelation) {
      if (field.type === 'string') {
        // Generate deterministic content for testing
        data[fieldName] = `Generated ${fieldName} for ${type}`
      } else if (field.isArray && field.type === 'string') {
        // Generate array of strings
        data[fieldName] = [`Generated ${fieldName} item for ${type}`]
      }
    } else if (field.operator === '<-' && field.direction === 'backward') {
      // Backward relation to parent - set the parent's ID if this entity's
      // related type matches the parent type
      if (field.relatedType === context.parent && context.parentId) {
        // Store the parent ID directly - this is a reference back to the parent
        data[fieldName] = context.parentId
      }
    } else if (field.operator === '->' && field.direction === 'forward') {
      // Recursively generate nested forward exact relations
      // This handles cases like Person.bio -> Bio
      if (!field.isOptional) {
        const nestedGenerated = await generateEntity(
          field.relatedType!,
          field.prompt,
          { parent: type, parentData: data },
          schema
        )
        // We need to create the nested entity too, but we can't do that here
        // because we don't have access to the provider yet.
        // This will be handled by resolveForwardExact when it calls us
        data[`_pending_${fieldName}`] = { type: field.relatedType!, data: nestedGenerated }
      }
    }
  }
  return data
}

/**
 * Resolve forward exact (->) fields by auto-generating related entities
 *
 * When creating an entity with a -> field, if no value is provided,
 * we auto-generate the related entity and link it.
 *
 * Returns resolved data and pending relationships that need to be created
 * after the parent entity is created (for array fields).
 *
 * @param parentId - Pre-generated ID of the parent entity, so generated children
 *                   can set backward references to it
 */
async function resolveForwardExact(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider,
  parentId: string
): Promise<{ data: Record<string, unknown>; pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string }> }> {
  const resolved = { ...data }
  const pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string }> = []

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '->' && field.direction === 'forward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        // If value is provided for array field, we still need to create relationships
        if (field.isArray && Array.isArray(resolved[fieldName])) {
          const ids = resolved[fieldName] as string[]
          for (const targetId of ids) {
            pendingRelations.push({ fieldName, targetType: field.relatedType!, targetId })
          }
        }
        continue
      }

      // Skip optional fields - they shouldn't auto-generate
      if (field.isOptional) continue

      if (field.isArray) {
        // Forward array relation - check if we should auto-generate
        const relatedEntity = schema.entities.get(field.relatedType!)
        if (!relatedEntity) continue

        // Check if related entity has a backward ref to this type (symmetric relationship)
        let hasBackwardRef = false
        for (const [, relField] of relatedEntity.fields) {
          if (relField.isRelation &&
              relField.relatedType === typeName &&
              relField.direction === 'backward') {
            hasBackwardRef = true
            break
          }
        }

        // Check if related entity has required non-relation fields
        let hasRequiredScalarFields = false
        for (const [, relField] of relatedEntity.fields) {
          if (!relField.isRelation && !relField.isOptional) {
            hasRequiredScalarFields = true
            break
          }
        }

        // Decide whether to auto-generate:
        // - If there's a symmetric backward ref AND required scalars, skip (prevents duplicates)
        // - Otherwise, generate if the related entity can be meaningfully generated
        const shouldSkip = hasBackwardRef && hasRequiredScalarFields
        const canGenerate = !shouldSkip && (
          hasBackwardRef ||  // Symmetric ref without required scalars
          field.prompt ||    // Has a generation prompt
          !hasRequiredScalarFields  // No required fields to worry about
        )

        if (!canGenerate) continue

        const generated = await generateEntity(
          field.relatedType!,
          field.prompt,
          { parent: typeName, parentData: data, parentId },
          schema
        )

        // Resolve any pending nested relations in the generated data
        const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
        const created = await provider.create(field.relatedType!, undefined, resolvedGenerated)
        resolved[fieldName] = [created.$id]

        // Queue relationship creation for after parent entity is created
        pendingRelations.push({ fieldName, targetType: field.relatedType!, targetId: created.$id as string })
      } else {
        // Single non-optional forward relation - generate the related entity
        // Generate single entity
        const generated = await generateEntity(
          field.relatedType!,
          field.prompt,
          { parent: typeName, parentData: data, parentId },
          schema
        )

        // Resolve any pending nested relations in the generated data
        const relatedEntity = schema.entities.get(field.relatedType!)
        if (relatedEntity) {
          const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
          const created = await provider.create(field.relatedType!, undefined, resolvedGenerated)
          resolved[fieldName] = created.$id
        }
      }
    }
  }
  return { data: resolved, pendingRelations }
}

/**
 * Generate a simple entity with only scalar fields populated
 *
 * This is used by cascade generation to avoid infinite recursion.
 * Unlike generateEntity, this does NOT recursively generate nested relations.
 *
 * @param type - The type of entity to generate
 * @param prompt - Optional prompt for generation context
 * @param context - Parent context information
 * @param entityDef - The parsed entity definition
 */
function generateSimpleEntity(
  type: string,
  prompt: string | undefined,
  context: { parent: string; parentData: Record<string, unknown>; parentId?: string },
  entityDef: ParsedEntity
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  for (const [fieldName, field] of entityDef.fields) {
    if (!field.isRelation) {
      // Only generate scalar fields
      if (field.type === 'string') {
        data[fieldName] = `Generated ${fieldName} for ${type}`
      } else if (field.isArray && field.type === 'string') {
        data[fieldName] = [`Generated ${fieldName} item for ${type}`]
      }
    } else if (field.operator === '<-' && field.direction === 'backward') {
      // Backward relation to parent
      if (field.relatedType === context.parent && context.parentId) {
        data[fieldName] = context.parentId
      }
    }
    // Skip forward relations - cascade will handle them
  }

  return data
}

/**
 * Recursively generate related entities through cascade relationships
 *
 * This function traverses -> and ~> array relationships and generates
 * child entities at each level, respecting depth limits and type filters.
 *
 * @param entity - The parent entity data
 * @param entityDef - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider
 * @param options - Cascade options including maxDepth and type filters
 * @param depth - Current recursion depth
 * @param progress - Progress tracking object (mutated)
 */
async function cascadeGenerate(
  entity: Record<string, unknown>,
  entityDef: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider,
  options: CascadeOptions,
  depth: number,
  progress: CascadeProgress
): Promise<void> {
  const maxDepth = options.maxDepth ?? 3

  // Stop if we've reached max depth
  if (depth >= maxDepth) return

  const entityId = (entity.$id || entity.id) as string

  for (const [fieldName, field] of entityDef.fields) {
    // Only cascade through forward relationships (-> or ~>) that are arrays
    // or single references that haven't been populated yet
    const isForwardRelation = field.operator === '->' || field.operator === '~>'
    const isGeneratableRelation = isForwardRelation && field.relatedType

    if (!isGeneratableRelation) continue

    // Check if this type should be cascaded (if cascadeTypes filter is set)
    if (options.cascadeTypes && !options.cascadeTypes.includes(field.relatedType!)) {
      continue
    }

    // Report progress for this type
    progress.currentDepth = depth
    progress.depth = depth
    progress.currentType = field.relatedType
    options.onProgress?.({ ...progress, phase: 'generating' })

    try {
      const relatedEntityDef = schema.entities.get(field.relatedType!)
      if (!relatedEntityDef) continue

      // Check if field already has values (from existing resolution)
      const existingValue = entity[fieldName]
      if (existingValue && Array.isArray(existingValue) && existingValue.length > 0) {
        // Already has values, cascade into each child
        for (const childId of existingValue) {
          const childData = await provider.get(field.relatedType!, childId as string)
          if (childData) {
            await cascadeGenerate(childData, relatedEntityDef, schema, provider, options, depth + 1, progress)
          }
        }
        continue
      } else if (existingValue && typeof existingValue === 'string') {
        // Single reference already populated, cascade into it
        const childData = await provider.get(field.relatedType!, existingValue)
        if (childData) {
          await cascadeGenerate(childData, relatedEntityDef, schema, provider, options, depth + 1, progress)
        }
        continue
      }

      // Generate new related entities
      if (field.isArray) {
        // Generate array of related entities
        // Use generateSimpleEntity to avoid infinite recursion
        const generated = generateSimpleEntity(
          field.relatedType!,
          field.prompt,
          { parent: entityDef.name, parentData: entity, parentId: entityId },
          relatedEntityDef
        )

        const created = await provider.create(field.relatedType!, undefined, generated)

        // Update the parent entity with the new relation
        const existingIds = (entity[fieldName] as string[]) || []
        const newIds = [...existingIds, created.$id as string]
        await provider.update(entityDef.name, entityId, { [fieldName]: newIds })
        entity[fieldName] = newIds

        // Create relationship
        await provider.relate(entityDef.name, entityId, fieldName, field.relatedType!, created.$id as string)

        progress.totalEntitiesCreated++
        if (!progress.typesGenerated.includes(field.relatedType!)) {
          progress.typesGenerated.push(field.relatedType!)
        }

        // Recursively cascade into the new child
        await cascadeGenerate(created, relatedEntityDef, schema, provider, options, depth + 1, progress)
      } else {
        // Generate single related entity using simple generation
        const generated = generateSimpleEntity(
          field.relatedType!,
          field.prompt,
          { parent: entityDef.name, parentData: entity, parentId: entityId },
          relatedEntityDef
        )

        const created = await provider.create(field.relatedType!, undefined, generated)

        // Update the parent entity with the new relation
        await provider.update(entityDef.name, entityId, { [fieldName]: created.$id })
        entity[fieldName] = created.$id

        progress.totalEntitiesCreated++
        if (!progress.typesGenerated.includes(field.relatedType!)) {
          progress.typesGenerated.push(field.relatedType!)
        }

        // Recursively cascade into the new child
        await cascadeGenerate(created, relatedEntityDef, schema, provider, options, depth + 1, progress)
      }
    } catch (error) {
      options.onError?.(error as Error, { type: field.relatedType!, depth })
      if (options.stopOnError) throw error
    }
  }
}

/**
 * Resolve backward fuzzy (<~) fields by using semantic search to find existing entities
 *
 * The <~ operator differs from <- in that it uses semantic/fuzzy matching:
 * - Uses AI/embedding-based similarity to find the best match from existing entities
 * - Does NOT generate new entities - only grounds to existing reference data
 * - Uses hint fields (e.g., categoryHint for category field) to guide matching
 *
 * @param typeName - The type of entity being created
 * @param data - The input data including hint fields
 * @param entity - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider (must support semanticSearch)
 * @returns The resolved data with backward fuzzy fields populated with matched entity IDs
 */
async function resolveBackwardFuzzy(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Record<string, unknown>> {
  const resolved = { ...data }
  const threshold = (entity.schema as any)?.$fuzzyThreshold ?? 0.75

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '<~' && field.direction === 'backward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        continue
      }

      // Get the hint field value - uses fieldNameHint convention
      const hintKey = `${fieldName}Hint`
      const searchQuery = (data[hintKey] as string) || field.prompt || ''

      // Skip if no search query available (optional fields without hint)
      if (!searchQuery) {
        continue
      }

      // Check if provider supports semantic search
      if ('semanticSearch' in provider) {
        const matches = await (provider as any).semanticSearch(
          field.relatedType!,
          searchQuery,
          { minScore: threshold, limit: field.isArray ? 10 : 1 }
        )

        if (matches.length > 0) {
          if (field.isArray) {
            // For array fields, return all matches above threshold
            resolved[fieldName] = matches
              .filter((m: any) => m.$score >= threshold)
              .map((m: any) => m.$id)
          } else {
            // For single fields, return the best match
            resolved[fieldName] = matches[0].$id
          }
        }
      }
      // Note: <~ typically doesn't generate - it grounds to existing data
      // If no match found and field is optional, leave as undefined
    }
  }

  return resolved
}

/**
 * Resolve forward fuzzy (~>) fields via semantic search then generation
 *
 * The ~> operator differs from -> in that it first attempts semantic search:
 * - Searches existing entities via embedding similarity
 * - If a match is found above threshold, reuses the existing entity
 * - If no match is found, generates a new entity
 * - Respects configurable similarity threshold ($fuzzyThreshold or field-level)
 *
 * @param typeName - The type of entity being created
 * @param data - The input data including hint fields
 * @param entity - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider (must support semanticSearch)
 * @param parentId - Pre-generated ID of the parent entity for backward refs
 * @returns Object with resolved data and pending relations for array fields
 */
async function resolveForwardFuzzy(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider,
  parentId: string
): Promise<{ data: Record<string, unknown>; pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number; matchedType?: string }> }> {
  const resolved = { ...data }
  const pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number; matchedType?: string }> = []
  // Default threshold from entity schema or 0.75
  const defaultThreshold = (entity.schema as any)?.$fuzzyThreshold ?? 0.75

  /**
   * Search all union types in parallel and return the best match
   */
  async function searchUnionTypes(
    types: string[],
    searchQuery: string,
    threshold: number
  ): Promise<{ id: string; type: string; score: number } | null> {
    if (!('semanticSearch' in provider)) return null

    // Search all types in parallel
    const allMatches = await Promise.all(
      types.map(async type => {
        const matches = await (provider as any).semanticSearch(type, searchQuery, { minScore: threshold, limit: 3 })
        return matches.map((m: any) => ({ ...m, $matchedType: type }))
      })
    )

    // Flatten and find the best match
    const flat = allMatches.flat()
    if (flat.length === 0) return null

    const best = flat.reduce((a: any, b: any) => (a.$score > b.$score ? a : b))
    return best.$score >= threshold ? { id: best.$id, type: best.$matchedType, score: best.$score } : null
  }

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '~>' && field.direction === 'forward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        // If value is provided for array field, we still need to create relationships
        if (field.isArray && Array.isArray(resolved[fieldName])) {
          const ids = resolved[fieldName] as string[]
          for (const targetId of ids) {
            pendingRelations.push({ fieldName, targetType: field.relatedType!, targetId })
          }
        }
        continue
      }

      // Get the hint field value - uses fieldNameHint convention
      const hintKey = `${fieldName}Hint`
      const hintValue = data[hintKey]
      const searchQuery = (typeof hintValue === 'string' ? hintValue : undefined) || field.prompt || fieldName

      // Get threshold - field-level overrides entity-level
      const threshold = field.threshold ?? defaultThreshold

      // Get all types to search (union types or just the single related type)
      const typesToSearch = field.unionTypes || [field.relatedType!]

      if (field.isArray) {
        // Array fuzzy field - can contain both matched and generated
        const hints = Array.isArray(hintValue) ? hintValue : [hintValue].filter(Boolean)
        const resultIds: string[] = []
        const matchedTypes: string[] = []

        for (const hint of hints) {
          const hintStr = String(hint || fieldName)
          let matched = false

          // Try semantic search across all union types
          const match = await searchUnionTypes(typesToSearch, hintStr, threshold)
          if (match) {
            resultIds.push(match.id)
            matchedTypes.push(match.type)
            pendingRelations.push({
              fieldName,
              targetType: match.type,
              targetId: match.id,
              similarity: match.score,
              matchedType: match.type
            })
            matched = true
          }

          // Generate if no match found - use first type in union
          if (!matched) {
            const generateType = typesToSearch[0]!
            const generated = await generateEntity(
              generateType,
              hintStr,
              { parent: typeName, parentData: data, parentId },
              schema
            )

            // Resolve any pending nested relations
            const relatedEntity = schema.entities.get(generateType)
            if (relatedEntity) {
              const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
              const created = await provider.create(generateType, undefined, {
                ...resolvedGenerated,
                $generated: true,
                $generatedBy: 'fuzzy-resolution',
                $sourceField: fieldName
              })
              resultIds.push(created.$id as string)
              matchedTypes.push(generateType)
              pendingRelations.push({
                fieldName,
                targetType: generateType,
                targetId: created.$id as string,
                matchedType: generateType
              })
            }
          }
        }

        resolved[fieldName] = resultIds
        // Store matched types for array fields
        if (matchedTypes.length > 0) {
          resolved[`${fieldName}$matchedTypes`] = matchedTypes
        }
      } else {
        // Single fuzzy field
        let matched = false

        // Try semantic search across all union types
        const match = await searchUnionTypes(typesToSearch, searchQuery, threshold)
        if (match) {
          resolved[fieldName] = match.id
          resolved[`${fieldName}$matched`] = true
          resolved[`${fieldName}$score`] = match.score
          resolved[`${fieldName}$matchedType`] = match.type
          pendingRelations.push({
            fieldName,
            targetType: match.type,
            targetId: match.id,
            similarity: match.score,
            matchedType: match.type
          })
          matched = true
        }

        // Generate if no match found - use first type in union
        if (!matched) {
          const generateType = typesToSearch[0]!
          const generated = await generateEntity(
            generateType,
            field.prompt || searchQuery,
            { parent: typeName, parentData: data, parentId },
            schema
          )

          // Resolve any pending nested relations
          const relatedEntity = schema.entities.get(generateType)
          if (relatedEntity) {
            const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
            const created = await provider.create(generateType, undefined, {
              ...resolvedGenerated,
              $generated: true,
              $generatedBy: 'fuzzy-resolution',
              $sourceField: fieldName
            })
            resolved[fieldName] = created.$id
            resolved[`${fieldName}$matchedType`] = generateType
            pendingRelations.push({
              fieldName,
              targetType: generateType,
              targetId: created.$id as string,
              matchedType: generateType
            })
          }
        }
      }
    }
  }

  return { data: resolved, pendingRelations }
}

/**
 * Resolve pending nested relations in generated data
 *
 * When generateEntity encounters nested -> relations, it stores them as
 * _pending_fieldName entries. This function creates those entities and
 * replaces the pending entries with actual IDs.
 */
async function resolveNestedPending(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Record<string, unknown>> {
  const resolved = { ...data }

  for (const key of Object.keys(resolved)) {
    if (key.startsWith('_pending_')) {
      const fieldName = key.replace('_pending_', '')
      const pending = resolved[key] as { type: string; data: Record<string, unknown> }
      delete resolved[key]

      // Get the related entity to resolve its nested pending relations too
      const relatedEntity = schema.entities.get(pending.type)
      if (relatedEntity) {
        const resolvedNested = await resolveNestedPending(pending.data, relatedEntity, schema, provider)
        const created = await provider.create(pending.type, undefined, resolvedNested)
        resolved[fieldName] = created.$id
      }
    }
  }

  return resolved
}

// =============================================================================
// Two-Phase Draft/Resolve Helper Functions
// =============================================================================

/**
 * Generate natural language content for a relationship field
 *
 * In production, this would integrate with AI to generate contextual descriptions.
 * For testing, generates deterministic content based on field name and type.
 */
function generateNaturalLanguageContent(
  fieldName: string,
  prompt: string | undefined,
  targetType: string,
  context: Record<string, unknown>
): string {
  // Use prompt if available, otherwise generate from field name
  if (prompt) {
    // Extract key words from prompt for natural language
    const keyWords = prompt.toLowerCase()
    if (keyWords.includes('idea') || keyWords.includes('concept')) {
      return `A innovative idea for ${context.name || targetType}`
    }
    if (keyWords.includes('customer') || keyWords.includes('buyer') || keyWords.includes('user')) {
      return `The target customer segment for ${context.name || targetType}`
    }
    if (keyWords.includes('related') || keyWords.includes('similar')) {
      return `Related ${targetType.toLowerCase()} content`
    }
    if (keyWords.includes('person') || keyWords.includes('find')) {
      return `A suitable ${targetType.toLowerCase()} for the task`
    }
  }

  // Generate based on field name patterns
  const fieldLower = fieldName.toLowerCase()
  if (fieldLower.includes('idea')) {
    return `A compelling idea for ${context.name || 'the project'}`
  }
  if (fieldLower.includes('customer')) {
    return `The ideal customer for ${context.name || 'the business'}`
  }
  if (fieldLower.includes('founder') || fieldLower.includes('lead') || fieldLower.includes('ceo') || fieldLower.includes('cto') || fieldLower.includes('cfo')) {
    return `A qualified ${fieldName} candidate`
  }
  if (fieldLower.includes('author') || fieldLower.includes('reviewer')) {
    return `An experienced ${fieldName}`
  }
  if (fieldLower.includes('assignee') || fieldLower.includes('owner')) {
    return `The right person for ${context.title || context.name || 'this task'}`
  }
  if (fieldLower.includes('department') || fieldLower.includes('team')) {
    return `A department for ${context.name || 'the organization'}`
  }
  if (fieldLower.includes('client') || fieldLower.includes('sponsor')) {
    return `A ${fieldName} for ${context.name || context.title || 'the project'}`
  }
  if (fieldLower.includes('item') || fieldLower.includes('component')) {
    return `${targetType} component`
  }
  if (fieldLower.includes('member') || fieldLower.includes('project')) {
    return `${targetType} for ${context.name || 'the team'}`
  }
  if (fieldLower.includes('character')) {
    return `A character for ${context.title || context.name || 'the story'}`
  }
  if (fieldLower.includes('setting') || fieldLower.includes('location')) {
    return `A setting for ${context.title || context.name || 'the story'}`
  }
  if (fieldLower.includes('address')) {
    return `Address information`
  }

  // Default fallback
  return `A ${targetType.toLowerCase()} for ${fieldName}`
}

/**
 * Resolve a single reference specification to an entity ID
 *
 * For exact matches (-> and <-), creates new entities.
 * For fuzzy matches (~> and <~), searches for existing entities first.
 */
async function resolveReferenceSpec(
  spec: ReferenceSpec,
  contextData: Record<string, unknown>,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<string | null> {
  const targetEntity = schema.entities.get(spec.type)
  if (!targetEntity) {
    throw new Error(`Unknown target type: ${spec.type}`)
  }

  if (spec.matchMode === 'fuzzy') {
    // For fuzzy references, try to find an existing entity first
    if ('semanticSearch' in provider) {
      const searchQuery = spec.generatedText || spec.prompt || spec.field
      const matches = await (provider as any).semanticSearch(spec.type, searchQuery, {
        minScore: 0.5,
        limit: 1,
      })

      if (matches.length > 0) {
        return matches[0].$id
      }
    }

    // If no match found for fuzzy, fall through to create
  }

  // Create a new entity
  const generatedData: Record<string, unknown> = {}

  // Generate default values for the target entity's fields
  for (const [fieldName, field] of targetEntity.fields) {
    if (!field.isRelation && !field.isOptional) {
      if (field.type === 'string') {
        generatedData[fieldName] = `Generated ${fieldName} for ${spec.type}`
      } else if (field.type === 'number') {
        generatedData[fieldName] = 0
      } else if (field.type === 'boolean') {
        generatedData[fieldName] = false
      }
    } else if (field.isRelation && field.operator === '->' && !field.isArray && !field.isOptional) {
      // Recursively resolve nested forward exact relations
      const nestedSpec: ReferenceSpec = {
        field: fieldName,
        operator: '->',
        type: field.relatedType!,
        matchMode: 'exact',
        resolved: false,
        prompt: field.prompt,
      }
      const nestedId = await resolveReferenceSpec(nestedSpec, generatedData, schema, provider)
      if (nestedId) {
        generatedData[fieldName] = nestedId
      }
    }
  }

  const created = await provider.create(spec.type, undefined, {
    ...generatedData,
    $generated: true,
    $generatedBy: spec.matchMode === 'fuzzy' ? 'fuzzy-resolution' : 'reference-resolution',
    $sourceField: spec.field,
  })
  return created.$id as string
}

/**
 * Create operations for a single entity type
 */
function createEntityOperations<T>(
  typeName: string,
  entity: ParsedEntity,
  schema: ParsedSchema
): EntityOperations<T> {
  return {
    async get(id: string): Promise<T | null> {
      const provider = await resolveProvider()
      const result = await provider.get(typeName, id)
      if (!result) return null
      return hydrateEntity(result, entity, schema) as T
    },

    async list(options?: ListOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async find(where: Partial<T>): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, {
        where: where as Record<string, unknown>,
      })
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async search(query: string, options?: SearchOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.search(typeName, query, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async create(
      idOrData: string | Omit<T, '$id' | '$type'>,
      maybeDataOrOptions?: Omit<T, '$id' | '$type'> | CreateEntityOptions,
      maybeOptions?: CreateEntityOptions
    ): Promise<T> {
      const provider = await resolveProvider()

      // Parse arguments: support both (data, options) and (id, data, options) signatures
      let providedId: string | undefined
      let data: Record<string, unknown>
      let options: CreateEntityOptions | undefined

      if (typeof idOrData === 'string') {
        // First arg is ID
        providedId = idOrData
        data = maybeDataOrOptions as Record<string, unknown>
        options = maybeOptions
      } else {
        // First arg is data
        providedId = undefined
        data = idOrData as Record<string, unknown>
        // Check if second arg is options or data
        if (maybeDataOrOptions && ('cascade' in maybeDataOrOptions || 'maxDepth' in maybeDataOrOptions || 'onProgress' in maybeDataOrOptions || 'onError' in maybeDataOrOptions || 'draftOnly' in maybeDataOrOptions || 'cascadeTypes' in maybeDataOrOptions || 'stopOnError' in maybeDataOrOptions)) {
          options = maybeDataOrOptions as CreateEntityOptions
        }
      }

      // Pre-generate entity ID so child entities can reference us
      const entityId = providedId || crypto.randomUUID()

      // Resolve forward exact (->) fields by auto-generating related entities
      // Pass the entityId so generated children can set backward references
      const { data: resolvedData, pendingRelations } = await resolveForwardExact(
        typeName,
        data,
        entity,
        schema,
        provider,
        entityId
      )

      // Resolve forward fuzzy (~>) fields by semantic search then generation
      const { data: fuzzyResolvedData, pendingRelations: fuzzyPendingRelations } = await resolveForwardFuzzy(
        typeName,
        resolvedData,
        entity,
        schema,
        provider,
        entityId
      )

      // Resolve backward fuzzy (<~) fields by semantic search against existing entities
      const finalData = await resolveBackwardFuzzy(
        typeName,
        fuzzyResolvedData,
        entity,
        schema,
        provider
      )

      const result = await provider.create(typeName, entityId, finalData)

      // Create relationships for array fields (exact)
      for (const rel of pendingRelations) {
        await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId)
      }

      // Create relationships for fuzzy fields with metadata
      // Track created Edge IDs to avoid duplicates
      const createdEdgeIds = new Set<string>()
      for (const rel of fuzzyPendingRelations) {
        await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId, {
          matchMode: 'fuzzy',
          similarity: rel.similarity
        })

        // Also create an Edge entity to store the fuzzy match metadata
        // Use a unique ID based on the relationship
        const edgeId = `${typeName}:${rel.fieldName}:${entityId}:${rel.targetId}`
        if (!createdEdgeIds.has(edgeId)) {
          createdEdgeIds.add(edgeId)
          try {
            await provider.create('Edge', edgeId, {
              from: typeName,
              name: rel.fieldName,
              to: rel.targetType,
              direction: 'forward',
              matchMode: 'fuzzy',
              similarity: rel.similarity,
              fromId: entityId,
              toId: rel.targetId,
            })
          } catch {
            // Edge already exists (could happen with duplicate targetIds), ignore
          }
        }
      }

      // If cascade is enabled, recursively generate related entities
      if (options?.cascade) {
        const progress: CascadeProgress = {
          phase: 'generating',
          currentDepth: 0,
          depth: 0,
          totalEntitiesCreated: 1, // Count the root entity
          typesGenerated: [typeName],
        }

        // Report initial progress
        options.onProgress?.({ ...progress })

        try {
          await cascadeGenerate(
            result,
            entity,
            schema,
            provider,
            options,
            0,
            progress
          )

          // Report completion
          progress.phase = 'complete'
          options.onProgress?.({ ...progress })
        } catch (error) {
          progress.phase = 'error'
          options.onProgress?.({ ...progress })
          if (options.stopOnError) throw error
        }
      }

      return hydrateEntity(result, entity, schema) as T
    },

    async update(
      id: string,
      data: Partial<Omit<T, '$id' | '$type'>>
    ): Promise<T> {
      const provider = await resolveProvider()
      const result = await provider.update(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T> {
      const provider = await resolveProvider()
      const existing = await provider.get(typeName, id)
      if (existing) {
        const result = await provider.update(
          typeName,
          id,
          data as Record<string, unknown>
        )
        return hydrateEntity(result, entity, schema) as T
      }
      const result = await provider.create(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async delete(id: string): Promise<boolean> {
      const provider = await resolveProvider()
      return provider.delete(typeName, id)
    },

    async forEach(
      optionsOrCallback:
        | ListOptions
        | ((entity: T) => void | Promise<void>),
      maybeCallback?: (entity: T) => void | Promise<void>
    ): Promise<void> {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback =
        typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch(query: string, options?: SemanticSearchOptions): Promise<Array<T & { $score: number }>> {
      const provider = await resolveProvider()
      if ('semanticSearch' in provider) {
        const results = await (provider as any).semanticSearch(typeName, query, options)
        return Promise.all(
          results.map((r: Record<string, unknown>) => ({
            ...hydrateEntity(r, entity, schema),
            $score: r.$score,
          } as T & { $score: number }))
        )
      }
      return []
    },

    async hybridSearch(query: string, options?: HybridSearchOptions): Promise<Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>> {
      const provider = await resolveProvider()
      if ('hybridSearch' in provider) {
        const results = await (provider as any).hybridSearch(typeName, query, options)
        return Promise.all(
          results.map((r: Record<string, unknown>) => ({
            ...hydrateEntity(r, entity, schema),
            $rrfScore: r.$rrfScore,
            $ftsRank: r.$ftsRank,
            $semanticRank: r.$semanticRank,
            $score: r.$score,
          } as T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }))
        )
      }
      return []
    },

    async draft(
      data: Partial<Omit<T, '$id' | '$type'>>,
      options?: DraftOptions
    ): Promise<Draft<T>> {
      const draftData: Record<string, unknown> = { ...data, $phase: 'draft' }
      const refs: Record<string, ReferenceSpec | ReferenceSpec[]> = {}

      // Process each field that has a relationship operator
      for (const [fieldName, field] of entity.fields) {
        // Skip if value already provided
        if (draftData[fieldName] !== undefined && draftData[fieldName] !== null) {
          continue
        }

        // Only process fields with relationship operators
        if (field.operator && field.relatedType) {
          const matchMode = field.matchMode ?? (field.operator.includes('~') ? 'fuzzy' : 'exact')

          if (field.isArray) {
            // Array relationship
            const generatedText = generateNaturalLanguageContent(fieldName, field.prompt, field.relatedType, data as Record<string, unknown>)
            draftData[fieldName] = generatedText

            // Create ref specs for array
            const refSpec: ReferenceSpec = {
              field: fieldName,
              operator: field.operator,
              type: field.relatedType,
              matchMode,
              resolved: false,
              prompt: field.prompt,
              generatedText,
            }
            refs[fieldName] = [refSpec]

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          } else {
            // Single relationship
            const generatedText = generateNaturalLanguageContent(fieldName, field.prompt, field.relatedType, data as Record<string, unknown>)
            draftData[fieldName] = generatedText

            refs[fieldName] = {
              field: fieldName,
              operator: field.operator,
              type: field.relatedType,
              matchMode,
              resolved: false,
              prompt: field.prompt,
              generatedText,
            }

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          }
        }
      }

      draftData.$refs = refs
      return draftData as Draft<T>
    },

    async resolve(
      draft: Draft<T>,
      options?: ResolveOptions
    ): Promise<Resolved<T>> {
      // Validate that this is actually a draft
      if ((draft as any).$phase !== 'draft') {
        throw new Error('Cannot resolve entity: not a draft (missing $phase: "draft")')
      }

      const provider = await resolveProvider()
      const resolved: Record<string, unknown> = { ...draft }
      const errors: Array<{ field: string; error: string }> = []

      // Remove draft markers
      delete resolved.$refs
      resolved.$phase = 'resolved'

      const refs = draft.$refs

      // Resolve each reference
      for (const [fieldName, refSpec] of Object.entries(refs)) {
        try {
          if (Array.isArray(refSpec)) {
            // Array of references
            const resolvedIds: string[] = []
            for (const spec of refSpec) {
              const resolvedId = await resolveReferenceSpec(spec, resolved, schema, provider)
              if (resolvedId) {
                resolvedIds.push(resolvedId)
                options?.onResolved?.(fieldName, resolvedId)
              }
            }
            resolved[fieldName] = resolvedIds
          } else {
            // Single reference
            const resolvedId = await resolveReferenceSpec(refSpec, resolved, schema, provider)
            if (resolvedId) {
              resolved[fieldName] = resolvedId
              options?.onResolved?.(fieldName, resolvedId)
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          if (options?.onError === 'skip') {
            errors.push({ field: fieldName, error: errorMsg })
          } else {
            throw err
          }
        }
      }

      // Add $errors if onError mode is 'skip' (even if empty, to indicate skip mode was used)
      // or if there are actual errors
      if (errors.length > 0 || options?.onError === 'skip') {
        (resolved as any).$errors = errors
      }

      return resolved as Resolved<T>
    },
  }
}

/**
 * Hydrate an entity with lazy-loaded relations
 *
 * For backward edges (direction === 'backward'), we query for entities
 * of the related type that have a reference pointing TO this entity.
 * This enables reverse lookups like "get all comments for a post".
 *
 * Backward reference resolution:
 * - Single backward ref with stored ID: resolve directly (e.g., member.team = teamId -> get Team by ID)
 * - Single backward ref without stored ID: find related entity that points to us via relations
 * - Array backward ref: find all entities of related type where their forward ref points to us
 */
function hydrateEntity(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema
): Record<string, unknown> {
  const hydrated: Record<string, unknown> = { ...data }
  const id = (data.$id || data.id) as string
  const typeName = entity.name

  // Add lazy getters for relations
  for (const [fieldName, field] of entity.fields) {
    if (field.isRelation && field.relatedType) {
      const relatedEntity = schema.entities.get(field.relatedType)
      if (!relatedEntity) continue

      // Check if this is a backward edge
      const isBackward = field.direction === 'backward'

      // For forward single relations with stored IDs, create a proxy that:
      // - Acts like a string (for .toMatch(), String(), etc.)
      // - Can be awaited to get the related entity (thenable)
      if (!isBackward && !field.isArray && data[fieldName]) {
        const storedId = data[fieldName] as string
        // For union types, get the actual matched type from stored metadata
        const matchedType = (data[`${fieldName}$matchedType`] as string) || field.relatedType!
        const actualRelatedEntity = schema.entities.get(matchedType) || relatedEntity

        const thenableProxy = new Proxy({} as Record<string, unknown>, {
          get(target, prop) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                return (async () => {
                  const provider = await resolveProvider()
                  const result = await provider.get(matchedType, storedId)
                  if (!result) return null
                  const hydratedResult = hydrateEntity(result, actualRelatedEntity, schema)
                  // Add $matchedType to the result for union type tracking
                  if (field.unionTypes && field.unionTypes.length > 0) {
                    (hydratedResult as any).$matchedType = matchedType
                  }
                  return hydratedResult
                })().then(resolve, reject)
              }
            }
            if (prop === Symbol.toPrimitive || prop === 'valueOf') {
              return () => storedId
            }
            if (prop === 'toString') {
              return () => storedId
            }
            if (prop === 'match') {
              return (regex: RegExp) => storedId.match(regex)
            }
            if (prop === '$type') {
              return matchedType
            }
            return undefined
          },
        })
        hydrated[fieldName] = thenableProxy
        continue
      }

      // Define lazy getter
      Object.defineProperty(hydrated, fieldName, {
        get: () => {
          // Check if this is a backward edge
          if (isBackward && !field.isArray) {
            // Case 1: Single backward ref
            // Returns a Promise that resolves to the related entity
            const storedId = data[fieldName] as string | undefined

            return (async () => {
              const provider = await resolveProvider()

              if (storedId) {
                // Has stored ID - directly fetch the related entity
                const result = await provider.get(field.relatedType!, storedId)
                return result
                  ? hydrateEntity(result, relatedEntity, schema)
                  : null
              }

              // No stored ID - find via inverse relation lookup
              // Find entities of relatedType that have this entity in their relations
              for (const [relFieldName, relField] of relatedEntity.fields) {
                if (relField.isRelation &&
                    relField.relatedType === typeName &&
                    relField.direction !== 'backward' &&
                    relField.isArray) {
                  // Found a forward array relation on related entity pointing to us
                  // Check if any entity of relatedType has this entity in that relation
                  const allRelated = await provider.list(field.relatedType!)
                  for (const candidate of allRelated) {
                    const candidateId = (candidate.$id || candidate.id) as string
                    const related = await provider.related(field.relatedType!, candidateId, relFieldName)
                    if (related.some(r => (r.$id || r.id) === id)) {
                      return hydrateEntity(candidate, relatedEntity, schema)
                    }
                  }
                }
              }
              return null
            })()
          }

          // For forward relations and backward arrays, return async resolver
          return (async () => {
            const provider = await resolveProvider()

            if (isBackward) {
              // Case 2: Array backward ref
              // Check if we have stored IDs (e.g., from backward fuzzy resolution)
              const storedIds = data[fieldName] as string[] | undefined
              if (Array.isArray(storedIds) && storedIds.length > 0) {
                // Use stored IDs directly - this handles backward fuzzy (<~) array fields
                const results = await Promise.all(
                  storedIds.map(targetId => provider.get(field.relatedType!, targetId))
                )
                return Promise.all(
                  results.filter(r => r !== null).map((r) => hydrateEntity(r!, relatedEntity, schema))
                )
              }

              // No stored IDs - use backref lookup
              // e.g., Blog.posts: ['<-Post'] - find Posts where post.blog === blog.$id
              // The backref tells us which field on the related type stores our ID
              // If no explicit backref, infer from schema relationships
              let backrefField = field.backref

              if (!backrefField) {
                // Infer backref: look for a field on related entity that points to us
                for (const [relFieldName, relField] of relatedEntity.fields) {
                  if (relField.isRelation &&
                      relField.relatedType === typeName &&
                      relField.direction !== 'backward' &&
                      !relField.isArray) {
                    // Found a forward single relation pointing to us - use its name
                    backrefField = relFieldName
                    break
                  }
                }

                // Fallback to entity name lowercase if no explicit relation found
                if (!backrefField) {
                  backrefField = typeName.toLowerCase()
                }
              }

              // Query the related type for entities that reference this entity
              const results = await provider.list(field.relatedType!, {
                where: { [backrefField]: id },
              })

              return Promise.all(
                results.map((r) => hydrateEntity(r, relatedEntity, schema))
              )
            } else if (field.isArray) {
              // Forward array relation - get related entities
              // For union types, we need to look up each entity from its matched type
              const storedIds = data[fieldName] as string[] | undefined
              const matchedTypes = data[`${fieldName}$matchedTypes`] as string[] | undefined

              if (storedIds && storedIds.length > 0 && field.unionTypes && matchedTypes) {
                // Union type array - fetch each entity from its specific type
                const results = await Promise.all(
                  storedIds.map(async (targetId, index) => {
                    const targetType = matchedTypes[index] || field.relatedType!
                    const targetEntity = schema.entities.get(targetType)
                    const result = await provider.get(targetType, targetId)
                    if (!result) return null
                    const hydrated = targetEntity
                      ? hydrateEntity(result, targetEntity, schema)
                      : result
                    // Add $matchedType for union type tracking
                    if (hydrated) {
                      (hydrated as any).$matchedType = targetType
                    }
                    return hydrated
                  })
                )
                return results.filter(r => r !== null)
              }

              // Non-union type array - use standard relation lookup
              const results = await provider.related(
                entity.name,
                id,
                fieldName
              )
              return Promise.all(
                results.map((r) => hydrateEntity(r, relatedEntity, schema))
              )
            } else {
              // Forward single relation - get the stored ID and fetch
              const relatedId = data[fieldName] as string | undefined
              if (!relatedId) return null
              const result = await provider.get(field.relatedType!, relatedId)
              return result
                ? hydrateEntity(result, relatedEntity, schema)
                : null
            }
          })()
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  return hydrated
}

// =============================================================================
// Re-export for convenience
// =============================================================================

export { parseSchema as parse }
