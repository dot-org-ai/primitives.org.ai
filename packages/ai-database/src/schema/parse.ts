/**
 * Schema Parsing Functions
 *
 * Contains parseOperator, parseField, parseSchema, and related parsing utilities.
 *
 * @packageDocumentation
 */

import type {
  PrimitiveType,
  FieldDefinition,
  EntitySchema,
  DatabaseSchema,
  ParsedField,
  ParsedEntity,
  ParsedSchema,
} from '../types.js'

import type { OperatorParseResult } from './types.js'

// =============================================================================
// Operator Parsing
// =============================================================================

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

// =============================================================================
// Field Parsing
// =============================================================================

/**
 * Check if a type string represents a primitive database type
 *
 * Primitive types are the basic scalar types that don't represent
 * relationships to other entities.
 *
 * @param type - The type string to check
 * @returns True if the type is a primitive (string, number, boolean, date, datetime, json, markdown, url)
 *
 * @example
 * ```ts
 * isPrimitiveType('string')    // => true
 * isPrimitiveType('Author')    // => false (entity reference)
 * isPrimitiveType('markdown')  // => true
 * ```
 */
export function isPrimitiveType(type: string): boolean {
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
 * Parse a single field definition into a structured ParsedField object
 *
 * Converts a field definition string into a structured ParsedField object,
 * handling primitives, relations, arrays, optionals, and operator syntax.
 *
 * ## Processing Order
 *
 * 1. Handle array literal syntax `['Type']`
 * 2. Extract operators (`->`, `~>`, `<-`, `<~`) using parseOperator
 * 3. Parse optional modifier (`?`)
 * 4. Parse array modifier (`[]`)
 * 5. Parse backref syntax (`Type.field`)
 * 6. Detect PascalCase relations
 *
 * @param name - The field name
 * @param definition - The field definition (string or array literal)
 * @returns Parsed field information including type, modifiers, and relation metadata
 *
 * @example Primitive field
 * ```ts
 * parseField('title', 'string')
 * // => { name: 'title', type: 'string', isArray: false, isOptional: false, isRelation: false }
 * ```
 *
 * @example Relation with backref
 * ```ts
 * parseField('author', 'Author.posts')
 * // => { name: 'author', type: 'Author', isRelation: true, relatedType: 'Author', backref: 'posts' }
 * ```
 *
 * @example Forward fuzzy relation
 * ```ts
 * parseField('category', '~>Category')
 * // => { name: 'category', operator: '~>', matchMode: 'fuzzy', direction: 'forward', ... }
 * ```
 */
export function parseField(name: string, definition: FieldDefinition): ParsedField {
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
    unionTypes = operatorResult.unionTypes
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

  // Check for relation (contains a dot for backref)
  if (type.includes('.')) {
    isRelation = true
    const [entityName, backrefName] = type.split('.')
    relatedType = entityName
    backref = backrefName
    type = entityName!
  } else if (
    type[0] === type[0]?.toUpperCase() &&
    !isPrimitiveType(type) &&
    !type.includes(' ')  // Type names don't have spaces - strings with spaces are prompts/descriptions
  ) {
    // PascalCase non-primitive = relation without explicit backref
    isRelation = true
    // For union types (A|B|C), set relatedType to the first type
    if (unionTypes && unionTypes.length > 0) {
      relatedType = unionTypes[0]
    } else {
      relatedType = type
    }
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
    // Add union types if present (more than one type)
    if (unionTypes && unionTypes.length > 1) {
      result.unionTypes = unionTypes
    }
  }

  return result
}

// =============================================================================
// Schema Parsing
// =============================================================================

/**
 * Parse a database schema definition and resolve bi-directional relationships
 *
 * This is the main schema parsing function that transforms a raw DatabaseSchema
 * into a fully resolved ParsedSchema with automatic backref creation.
 *
 * ## Processing Phases
 *
 * 1. **First pass**: Parse all entities and their fields, skipping metadata fields (`$*`)
 * 2. **Validation pass**: Verify all operator-based references point to existing types
 * 3. **Second pass**: Create bi-directional relationships from backrefs
 *
 * ## Automatic Backref Creation
 *
 * When a field specifies a backref (e.g., `author: 'Author.posts'`), the inverse
 * relation is automatically created on the related entity if it doesn't exist.
 *
 * @param schema - The raw database schema definition
 * @returns Parsed schema with resolved entities and bi-directional relationships
 * @throws Error if a field references a non-existent type
 *
 * @example
 * ```ts
 * const parsed = parseSchema({
 *   Post: { title: 'string', author: 'Author.posts' },
 *   Author: { name: 'string' }
 * })
 * // Author.posts is auto-created as Post[]
 * ```
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
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.operator) {
        // Only validate fields with explicit operators
        // Skip self-references (valid)
        if (field.relatedType === entityName) continue

        // For union types, validate each type in the union individually
        // But only if at least one union type exists in the schema
        // (allows "external" types when none are defined)
        if (field.unionTypes && field.unionTypes.length > 0) {
          const existingTypes = field.unionTypes.filter(t => entities.has(t))
          // Only validate if at least one union type exists in schema
          if (existingTypes.length > 0) {
            for (const unionType of field.unionTypes) {
              if (unionType !== entityName && !entities.has(unionType)) {
                throw new Error(
                  `Invalid schema: ${entityName}.${fieldName} references non-existent type '${unionType}'`
                )
              }
            }
          }
        } else {
          // Check if referenced type exists (non-union case)
          if (!entities.has(field.relatedType)) {
            throw new Error(
              `Invalid schema: ${entityName}.${fieldName} references non-existent type '${field.relatedType}'`
            )
          }
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
