/**
 * Noun Inference and Definition
 *
 * Provides inferNoun() for automatic noun inference from type names
 * and defineNoun() for explicit noun definition.
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, TypeMeta } from './types.js'
import { splitCamelCase, pluralize, toKebabCase } from './linguistic.js'

// =============================================================================
// Noun Inference
// =============================================================================

/**
 * Infer a complete Noun from just a type name
 *
 * Automatically generates singular/plural forms, default CRUD actions,
 * and event types from a PascalCase type name.
 *
 * @example
 * ```ts
 * inferNoun('BlogPost')
 * // => {
 * //   singular: 'blog post',
 * //   plural: 'blog posts',
 * //   actions: ['create', 'update', 'delete'],
 * //   events: ['created', 'updated', 'deleted'],
 * // }
 *
 * inferNoun('Category')
 * // => {
 * //   singular: 'category',
 * //   plural: 'categories',
 * //   actions: ['create', 'update', 'delete'],
 * //   events: ['created', 'updated', 'deleted'],
 * // }
 * ```
 */
export function inferNoun(typeName: string): Noun {
  const words = splitCamelCase(typeName)
  const singular = words.join(' ').toLowerCase()
  const lastWord = words[words.length - 1]!
  const plural = words.slice(0, -1).concat(pluralize(lastWord)).join(' ').toLowerCase()

  return {
    singular,
    plural,
    actions: ['create', 'update', 'delete'],
    events: ['created', 'updated', 'deleted'],
  }
}

// =============================================================================
// Noun Definition
// =============================================================================

/**
 * Options for defining a noun
 */
export interface DefineNounOptions {
  /** Singular form (required) */
  singular: string
  /** Plural form (auto-generated if not provided) */
  plural?: string
  /** Human-readable description */
  description?: string
  /** Property definitions */
  properties?: Record<string, NounProperty>
  /** Relationship definitions */
  relationships?: Record<string, NounRelationship>
  /** Actions that can be performed */
  actions?: string[]
  /** Events that can occur */
  events?: string[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Define a complete Noun with all metadata
 *
 * @example
 * ```ts
 * const Person = defineNoun({
 *   singular: 'person',
 *   plural: 'people',
 *   description: 'A human individual',
 *   properties: {
 *     name: { type: 'string', description: 'Full name' },
 *     email: { type: 'email', description: 'Email address' },
 *   },
 *   relationships: {
 *     manager: { type: 'Person', operator: '->', description: 'Direct manager' },
 *   },
 *   actions: ['create', 'update', 'delete', 'archive'],
 *   events: ['created', 'updated', 'deleted', 'archived'],
 * })
 * ```
 */
export function defineNoun(options: DefineNounOptions): Noun {
  const noun: Noun = {
    singular: options.singular,
    plural: options.plural ?? pluralize(options.singular),
    actions: options.actions ?? ['create', 'update', 'delete'],
    events: options.events ?? ['created', 'updated', 'deleted'],
  }
  if (options.description !== undefined) noun.description = options.description
  if (options.properties !== undefined) noun.properties = options.properties
  if (options.relationships !== undefined) noun.relationships = options.relationships
  if (options.metadata !== undefined) noun.metadata = options.metadata
  return noun
}

// =============================================================================
// Type Metadata
// =============================================================================

/**
 * Create TypeMeta from a type name - all linguistic forms auto-inferred
 *
 * @example
 * ```ts
 * const meta = createTypeMeta('BlogPost')
 * meta.singular  // 'blog post'
 * meta.plural    // 'blog posts'
 * meta.slug      // 'blog-post'
 * meta.created   // 'BlogPost.created'
 * meta.createdAt // 'createdAt'
 * meta.creator   // 'creator'
 * ```
 */
export function createTypeMeta(typeName: string): TypeMeta {
  const noun = inferNoun(typeName)
  const slug = toKebabCase(typeName)
  const slugPlural = noun.plural.replace(/\s+/g, '-')

  return {
    name: typeName,
    singular: noun.singular,
    plural: noun.plural,
    slug,
    slugPlural,

    // From Verbs.create
    creator: 'creator',
    createdAt: 'createdAt',
    createdBy: 'createdBy',
    updatedAt: 'updatedAt',
    updatedBy: 'updatedBy',

    // Event types
    created: `${typeName}.created`,
    updated: `${typeName}.updated`,
    deleted: `${typeName}.deleted`,
  }
}

/** Cache of TypeMeta by type name */
const typeMetaCache = new Map<string, TypeMeta>()

/**
 * Get or create TypeMeta for a type name (cached)
 */
export function getTypeMeta(typeName: string): TypeMeta {
  let meta = typeMetaCache.get(typeName)
  if (!meta) {
    meta = createTypeMeta(typeName)
    typeMetaCache.set(typeName, meta)
  }
  return meta
}

/**
 * Type proxy - provides dynamic access to type metadata
 *
 * @example
 * ```ts
 * const Post = Type('Post')
 * Post.singular  // 'post'
 * Post.plural    // 'posts'
 * Post.created   // 'Post.created'
 *
 * // In event handlers:
 * on.create(thing => {
 *   console.log(thing.$type.plural)  // 'posts'
 * })
 * ```
 */
export function Type(name: string): TypeMeta {
  return getTypeMeta(name)
}

/**
 * Clear the type metadata cache (useful for testing)
 */
export function clearTypeMetaCache(): void {
  typeMetaCache.clear()
}
