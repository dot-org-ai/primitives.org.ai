/**
 * Graph DSL Function
 *
 * Provides the main Graph() function for defining entity graphs with
 * type mappings, relationships, and MDXLD conventions.
 *
 * @packageDocumentation
 */

import type {
  GraphInput,
  EntityDefinition,
  ParsedGraph,
  ParsedEntity,
  ParsedField,
  PrimitiveType,
} from './types.js'
import { parseOperator } from './relationship.js'

// =============================================================================
// Constants
// =============================================================================

import { PRIMITIVE_TYPES } from './dependency-graph.js'

/**
 * Type aliases that resolve to canonical primitive type names.
 *
 * These allow shorthand or alternate spellings to be used in schema
 * definitions while normalizing to a single canonical type internally.
 *
 * | Alias  | Resolves To |
 * |--------|-------------|
 * | `bool` | `boolean`   |
 */
export const TYPE_ALIASES: Record<string, string> = {
  bool: 'boolean',
}

/**
 * Check if a type string represents a primitive type
 */
function isPrimitiveType(type: string): type is PrimitiveType {
  return PRIMITIVE_TYPES.has(type)
}

// =============================================================================
// Field Parsing
// =============================================================================

/**
 * Parse a single field definition into a ParsedField
 */
function parseField(name: string, definition: string | [string]): ParsedField {
  // Handle array literal syntax: ['->Author.posts']
  if (Array.isArray(definition)) {
    const inner = parseField(name, definition[0])
    return { ...inner, isArray: true }
  }

  let type = definition

  // Try to parse as a relationship operator first
  const operatorResult = parseOperator(type)
  if (operatorResult) {
    const result: ParsedField = {
      name,
      type: operatorResult.targetType,
      isArray: operatorResult.isArray ?? false,
      isOptional: operatorResult.isOptional ?? false,
      isRelation: true,
      relatedType: operatorResult.targetType,
      operator: operatorResult.operator,
      direction: operatorResult.direction,
      matchMode: operatorResult.matchMode,
    }
    if (operatorResult.backref !== undefined) result.backref = operatorResult.backref
    if (operatorResult.threshold !== undefined) result.threshold = operatorResult.threshold
    if (operatorResult.unionTypes !== undefined) result.unionTypes = operatorResult.unionTypes
    if (operatorResult.prompt !== undefined) result.prompt = operatorResult.prompt
    if (operatorResult.isRequired) result.isRequired = true
    if (operatorResult.isUnique) result.isUnique = true
    if (operatorResult.isIndexed) result.isIndexed = true
    return result
  }

  // Not an operator - parse as regular field
  let isArray = false
  let isOptional = false
  let isRequired = false
  let isUnique = false
  let isIndexed = false
  let isRelation = false
  let relatedType: string | undefined
  let backref: string | undefined

  // Parse modifiers from the end, handling any order
  // Modifiers are: ?, [], !, #
  // Only parse if type doesn't contain spaces (prompts may have these characters)
  if (!type.includes(' ')) {
    let parsing = true
    while (parsing) {
      if (type.endsWith('#')) {
        isIndexed = true
        type = type.slice(0, -1)
      } else if (type.endsWith('!')) {
        isRequired = true
        isUnique = true
        type = type.slice(0, -1)
      } else if (type.endsWith('?')) {
        isOptional = true
        type = type.slice(0, -1)
      } else if (type.endsWith('[]')) {
        isArray = true
        type = type.slice(0, -2)
      } else {
        parsing = false
      }
    }
  }

  // Resolve type aliases (e.g., bool -> boolean)
  if (type in TYPE_ALIASES) {
    type = TYPE_ALIASES[type]!
  }

  // Check for backref syntax (Type.field)
  if (type.includes('.') && !type.startsWith('http')) {
    isRelation = true
    const [entityName, backrefName] = type.split('.')
    relatedType = entityName
    backref = backrefName
    type = entityName ?? type
  } else if (
    type[0] === type[0]?.toUpperCase() &&
    !isPrimitiveType(type) &&
    !type.includes(' ') && // Type names don't have spaces
    !type.startsWith('http') // Not a URL
  ) {
    // PascalCase non-primitive = relation without explicit backref
    isRelation = true
    relatedType = type
  }

  const result: ParsedField = {
    name,
    type,
    isArray,
    isOptional,
    isRelation,
  }
  if (isRequired) result.isRequired = true
  if (isUnique) result.isUnique = true
  if (isIndexed) result.isIndexed = true
  if (relatedType !== undefined) result.relatedType = relatedType
  if (backref !== undefined) result.backref = backref
  return result
}

/**
 * Parse an entity definition
 *
 * Handles both simple type URI strings and object definitions with fields.
 * Collects $ prefixed properties as directives for downstream consumers,
 * supporting passthrough of IceType-style configuration like $partitionBy,
 * $index, $fts, $vector, etc.
 *
 * @param name - Entity name
 * @param definition - Entity definition (string URI or object with fields)
 * @returns Parsed entity with fields and directives
 */
function parseEntity(name: string, definition: EntityDefinition): ParsedEntity {
  // Simple type URI string
  if (typeof definition === 'string') {
    const entity: ParsedEntity = {
      name,
      fields: new Map(),
    }
    entity.$type = definition
    return entity
  }

  // Object definition with fields
  const fields = new Map<string, ParsedField>()
  let $type: string | undefined
  const directives: Record<string, unknown> = {}

  for (const [fieldName, fieldDef] of Object.entries(definition)) {
    // Handle $type metadata
    if (fieldName === '$type') {
      $type = fieldDef as string
      continue
    }

    // Collect other $ prefixed directives for passthrough
    if (fieldName.startsWith('$')) {
      directives[fieldName] = fieldDef
      continue
    }

    // Parse field definition
    if (typeof fieldDef === 'string' || Array.isArray(fieldDef)) {
      fields.set(fieldName, parseField(fieldName, fieldDef as string | [string]))
    }
  }

  const entity: ParsedEntity = {
    name,
    fields,
  }
  if ($type !== undefined) entity.$type = $type
  if (Object.keys(directives).length > 0) entity.directives = directives
  return entity
}

// =============================================================================
// Graph Function
// =============================================================================

/**
 * Create a parsed graph schema from entity definitions
 *
 * The Graph() function is the main DSL for defining entity graphs. It accepts
 * a record of entity definitions and returns a fully parsed graph with
 * resolved type URIs and field relationships.
 *
 * ## Entity Definition Formats
 *
 * ### Simple Type Mapping
 * ```ts
 * const schema = Graph({
 *   User: 'https://schema.org.ai/Person',
 *   Org: 'https://schema.org.ai/Organization',
 * })
 * ```
 *
 * ### With Properties and Relationships
 * ```ts
 * const schema = Graph({
 *   User: 'https://schema.org.ai/Person',
 *   Post: {
 *     $type: 'https://schema.org.ai/BlogPosting',
 *     title: 'string',
 *     content: 'markdown',
 *     author: '->User.posts',        // forward exact with backref
 *     categories: ['~>Category'],    // forward fuzzy array
 *   },
 *   Category: {
 *     $type: 'https://schema.org.ai/Category',
 *     name: 'string',
 *   },
 * })
 * ```
 *
 * ### With Passthrough Directives
 * ```ts
 * const schema = Graph({
 *   User: {
 *     $type: 'https://schema.org.ai/Person',
 *     $partitionBy: ['tenantId'],     // IceType partition key
 *     $index: [['email'], ['createdAt']], // Secondary indexes
 *     $fts: ['bio'],                  // Full-text search fields
 *     id: 'uuid!',
 *     email: 'string!#',
 *     tenantId: 'string',
 *   },
 * })
 *
 * // Access directives
 * schema.entities.get('User')?.directives
 * // => { $partitionBy: ['tenantId'], $index: [['email'], ['createdAt']], $fts: ['bio'] }
 * ```
 *
 * @param input - Entity definitions
 * @returns Parsed graph with entities and type URIs
 *
 * @example Basic usage
 * ```ts
 * const schema = Graph({
 *   User: 'https://schema.org.ai/Person',
 *   Post: {
 *     $type: 'https://schema.org.ai/BlogPosting',
 *     title: 'string',
 *     author: '->User',
 *   },
 * })
 *
 * // Access entities
 * schema.entities.get('Post')
 * // => { name: 'Post', $type: '...', fields: Map { 'title' => ..., 'author' => ... } }
 *
 * // Access type URIs
 * schema.typeUris.get('User')
 * // => 'https://schema.org.ai/Person'
 * ```
 */
export function Graph(input: GraphInput): ParsedGraph {
  const entities = new Map<string, ParsedEntity>()
  const typeUris = new Map<string, string>()

  // Handle empty input - return empty graph
  if (!input || Object.keys(input).length === 0) {
    return { entities, typeUris }
  }

  // First pass: parse all entities
  for (const [entityName, definition] of Object.entries(input)) {
    const entity = parseEntity(entityName, definition)
    entities.set(entityName, entity)

    // Collect type URIs
    if (entity.$type) {
      typeUris.set(entityName, entity.$type)
    }
  }

  // Second pass: create bi-directional relationships from backrefs
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.backref) {
        const relatedEntity = entities.get(field.relatedType)
        if (relatedEntity && !relatedEntity.fields.has(field.backref)) {
          // Auto-create the inverse relation
          // If Post.author -> User.posts, then User.posts -> Post[]
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

  return { entities, typeUris }
}

// =============================================================================
// Graph Utilities
// =============================================================================

/**
 * Get all entity names from a parsed graph
 */
export function getEntityNames(graph: ParsedGraph): string[] {
  return Array.from(graph.entities.keys())
}

/**
 * Get all type URIs from a parsed graph
 */
export function getTypeUris(graph: ParsedGraph): Map<string, string> {
  return graph.typeUris
}

/**
 * Get an entity by name from a parsed graph
 */
export function getEntity(graph: ParsedGraph, name: string): ParsedEntity | undefined {
  return graph.entities.get(name)
}

/**
 * Check if an entity exists in the graph
 */
export function hasEntity(graph: ParsedGraph, name: string): boolean {
  return graph.entities.has(name)
}

/**
 * Get all relationship fields for an entity
 */
export function getRelationshipFields(graph: ParsedGraph, entityName: string): ParsedField[] {
  const entity = graph.entities.get(entityName)
  if (!entity) return []

  return Array.from(entity.fields.values()).filter((field) => field.isRelation)
}

/**
 * Get all entities that reference a given entity
 */
export function getReferencingEntities(
  graph: ParsedGraph,
  entityName: string
): Array<{ entity: string; field: string }> {
  const result: Array<{ entity: string; field: string }> = []

  for (const [name, entity] of graph.entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType === entityName) {
        result.push({ entity: name, field: fieldName })
      }
    }
  }

  return result
}
