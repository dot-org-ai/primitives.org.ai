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
  SeedConfig,
} from '../types.js'

import type { OperatorParseResult } from './types.js'

import { parseOperator as graphdlParseOperator } from '@graphdl/core'

// =============================================================================
// Schema Validation Error
// =============================================================================

/**
 * Custom error class for schema validation errors
 */
export class SchemaValidationError extends Error {
  /** Error code for programmatic handling */
  code: string
  /** Path to the problematic element (e.g., 'User.name') */
  path?: string
  /** Additional details about the error */
  details?: string

  constructor(message: string, code: string, path?: string, details?: string) {
    super(message)
    this.name = 'SchemaValidationError'
    this.code = code
    if (path !== undefined) this.path = path
    if (details !== undefined) this.details = details
  }
}

// =============================================================================
// Validation Constants
// =============================================================================

/** Valid primitive types */
const VALID_PRIMITIVE_TYPES: PrimitiveType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'json',
  'markdown',
  'url',
]

/** Maximum entity name length */
const MAX_ENTITY_NAME_LENGTH = 64

/** Maximum field name length */
const MAX_FIELD_NAME_LENGTH = 64

/** Pattern for valid entity names: starts with letter, followed by letters/numbers/underscores */
const VALID_ENTITY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

/** Pattern for valid field names: starts with letter or underscore, followed by letters/numbers/underscores */
const VALID_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate an entity name
 *
 * @param name - The entity name to validate
 * @throws SchemaValidationError if the name is invalid
 */
export function validateEntityName(name: string): void {
  // Check for empty name
  if (!name || name.trim().length === 0) {
    throw new SchemaValidationError(
      `Invalid entity name: name cannot be empty. Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check length
  if (name.length > MAX_ENTITY_NAME_LENGTH) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': name exceeds maximum length of ${MAX_ENTITY_NAME_LENGTH} characters. Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check for SQL injection patterns (semicolons, comments, keywords)
  if (/[;'"`]|--|\bDROP\b|\bSELECT\b|\bUNION\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b/i.test(name)) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': contains potentially dangerous characters or SQL keywords. Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check for XSS patterns (script tags, HTML, JavaScript protocol)
  if (/<[^>]*>|javascript:|onerror|onclick|onload/i.test(name)) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': contains potentially dangerous HTML or JavaScript. Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check for angle brackets specifically
  if (/<|>/.test(name)) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': contains special characters (< or >). Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check for spaces
  if (/\s/.test(name)) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': contains spaces. Entity names must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }

  // Check the pattern (alphanumeric + underscores, must start with letter)
  if (!VALID_ENTITY_NAME_PATTERN.test(name)) {
    throw new SchemaValidationError(
      `Invalid entity name '${name}': must start with a letter and contain only letters, numbers, and underscores.`,
      'INVALID_ENTITY_NAME',
      name
    )
  }
}

/**
 * Validate a field name
 *
 * @param name - The field name to validate
 * @param entityName - The entity the field belongs to (for error messages)
 * @throws SchemaValidationError if the name is invalid
 */
export function validateFieldName(name: string, entityName: string): void {
  const path = `${entityName}.${name}`

  // Check for empty name
  if (!name || name.trim().length === 0) {
    throw new SchemaValidationError(
      `Invalid field name in '${entityName}': field name cannot be empty.`,
      'INVALID_FIELD_NAME',
      path
    )
  }

  // Check length
  if (name.length > MAX_FIELD_NAME_LENGTH) {
    throw new SchemaValidationError(
      `Invalid field name '${name}' in '${entityName}': name exceeds maximum length of ${MAX_FIELD_NAME_LENGTH} characters.`,
      'INVALID_FIELD_NAME',
      path
    )
  }

  // Check for SQL injection patterns
  if (/[;'"`]|--|\bDROP\b|\bSELECT\b|\bUNION\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b/i.test(name)) {
    throw new SchemaValidationError(
      `Invalid field name '${name}' in '${entityName}': contains potentially dangerous characters or SQL keywords.`,
      'INVALID_FIELD_NAME',
      path
    )
  }

  // Check for special characters (including @)
  if (!VALID_FIELD_NAME_PATTERN.test(name)) {
    throw new SchemaValidationError(
      `Invalid field name '${name}' in '${entityName}': must start with a letter or underscore and contain only letters, numbers, and underscores.`,
      'INVALID_FIELD_NAME',
      path
    )
  }
}

/**
 * Validate a field type
 *
 * @param typeDef - The field type definition to validate
 * @param fieldName - The field name (for error messages)
 * @param entityName - The entity name (for error messages)
 * @throws SchemaValidationError if the type is invalid
 */
export function validateFieldType(typeDef: string, fieldName: string, entityName: string): void {
  const path = `${entityName}.${fieldName}`

  // Check for empty type
  if (!typeDef || typeDef.trim().length === 0) {
    throw new SchemaValidationError(
      `Invalid field type for '${path}': type cannot be empty. Valid types are: ${VALID_PRIMITIVE_TYPES.join(
        ', '
      )}, or a PascalCase entity reference.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check for null bytes (security: prevents regex bypass attacks)
  if (typeDef.includes('\x00') || typeDef.includes('\0')) {
    throw new SchemaValidationError(
      `Invalid field type for '${path}': type contains null byte characters which are not allowed.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Strip modifiers to get the base type
  let baseType = typeDef.trim()

  // Check for double optional (string??)
  if (baseType.includes('??')) {
    throw new SchemaValidationError(
      `Invalid field type '${typeDef}' for '${path}': double optional modifier (??) is not allowed.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Remove optional modifier
  if (baseType.endsWith('?')) {
    baseType = baseType.slice(0, -1)
  }

  // Handle array suffix notation (e.g., string[]?)
  if (baseType.endsWith('[]?')) {
    baseType = baseType.slice(0, -3)
  }
  if (baseType.endsWith('[]')) {
    baseType = baseType.slice(0, -2)
  }

  // If it's an operator-based definition, we validate the target type separately
  if (
    /^(->|~>|<-|<~)/.test(baseType) ||
    baseType.includes('->') ||
    baseType.includes('~>') ||
    baseType.includes('<-') ||
    baseType.includes('<~')
  ) {
    // This will be validated in parseOperator
    return
  }

  // If it's a prompt field, treat it as a string field that will be AI-generated
  // Prompt fields can be identified by:
  // - Contains spaces: 'Describe the product', 'What are their main challenges?'
  // - Contains slashes (enum hints): 'low/medium/high', 'beginner/intermediate/expert'
  // - Contains question marks: 'What is the price?'
  if (baseType.includes(' ') || baseType.includes('/') || baseType.includes('?')) {
    // Prompt fields are valid - they're treated as string fields with AI generation
    return
  }

  // Handle backref syntax (Type.field)
  if (baseType.includes('.')) {
    const parts = baseType.split('.')
    baseType = parts[0]!
    // Validate the backref field name if there are multiple dots
    if (parts.length > 2) {
      throw new SchemaValidationError(
        `Invalid field type '${typeDef}' for '${path}': multiple dots in backref syntax are not allowed.`,
        'INVALID_FIELD_TYPE',
        path
      )
    }
    // Validate the backref field name
    const backrefName = parts[1]!
    if (!VALID_FIELD_NAME_PATTERN.test(backrefName)) {
      throw new SchemaValidationError(
        `Invalid backref field name '${backrefName}' in '${typeDef}' for '${path}': must start with a letter or underscore.`,
        'INVALID_FIELD_TYPE',
        path
      )
    }
  }

  // Check for invalid SQL types
  const sqlTypes = ['int', 'varchar', 'text', 'blob', 'integer', 'real', 'float', 'double']
  if (sqlTypes.includes(baseType.toLowerCase())) {
    const suggestion =
      baseType.toLowerCase() === 'int' || baseType.toLowerCase() === 'integer'
        ? 'number'
        : baseType.toLowerCase() === 'text' || baseType.toLowerCase() === 'varchar'
        ? 'string'
        : baseType.toLowerCase() === 'real' ||
          baseType.toLowerCase() === 'float' ||
          baseType.toLowerCase() === 'double'
        ? 'number'
        : 'string'
    throw new SchemaValidationError(
      `Invalid field type '${baseType}' for '${path}': SQL types are not supported. Did you mean '${suggestion}'? Valid types are: ${VALID_PRIMITIVE_TYPES.join(
        ', '
      )}.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check for invalid JavaScript types
  const jsTypes = ['object', 'array', 'function', 'symbol', 'bigint', 'undefined', 'null']
  if (jsTypes.includes(baseType.toLowerCase())) {
    throw new SchemaValidationError(
      `Invalid field type '${baseType}' for '${path}': JavaScript types are not supported. Valid types are: ${VALID_PRIMITIVE_TYPES.join(
        ', '
      )}.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check if it's a valid primitive or PascalCase entity reference
  const isPrimitive = VALID_PRIMITIVE_TYPES.includes(baseType as PrimitiveType)
  const isPascalCase = /^[A-Z][A-Za-z0-9_]*$/.test(baseType)

  if (!isPrimitive && !isPascalCase) {
    throw new SchemaValidationError(
      `Invalid field type '${baseType}' for '${path}': unknown type. Valid types are: ${VALID_PRIMITIVE_TYPES.join(
        ', '
      )}, or a PascalCase entity reference.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }
}

/**
 * Validate array field definition
 *
 * @param definition - The array field definition
 * @param fieldName - The field name (for error messages)
 * @param entityName - The entity name (for error messages)
 * @throws SchemaValidationError if the array syntax is invalid
 */
export function validateArrayDefinition(
  definition: unknown[],
  fieldName: string,
  entityName: string
): void {
  const path = `${entityName}.${fieldName}`

  // Check for empty array
  if (definition.length === 0) {
    throw new SchemaValidationError(
      `Invalid array field definition for '${path}': empty array syntax is not allowed. Use ['Type'] for array of Type.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check for multiple elements
  if (definition.length > 1) {
    throw new SchemaValidationError(
      `Invalid array field definition for '${path}': array syntax only supports single element. Use ['Type'] not ['Type1', 'Type2'].`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check for nested arrays
  if (Array.isArray(definition[0])) {
    throw new SchemaValidationError(
      `Invalid array field definition for '${path}': nested array syntax is not allowed. Use ['Type'] not [['Type']].`,
      'INVALID_FIELD_TYPE',
      path
    )
  }

  // Check that the inner element is a string
  if (typeof definition[0] !== 'string') {
    throw new SchemaValidationError(
      `Invalid array field definition for '${path}': array element must be a string type definition.`,
      'INVALID_FIELD_TYPE',
      path
    )
  }
}

/**
 * Validate operator target type
 *
 * @param targetType - The target type from the operator
 * @param operator - The operator used
 * @param fieldName - The field name (for error messages)
 * @throws SchemaValidationError if the target type is invalid
 */
export function validateOperatorTarget(
  targetType: string,
  operator: string,
  fieldName: string
): void {
  // Check for empty target type
  if (!targetType || targetType.trim().length === 0) {
    throw new SchemaValidationError(
      `Invalid operator '${operator}' for field '${fieldName}': missing target type. Use '${operator}Type' syntax.`,
      'INVALID_OPERATOR',
      fieldName
    )
  }

  // Strip modifiers for validation
  let baseType = targetType.trim()
  if (baseType.endsWith('?')) baseType = baseType.slice(0, -1)
  if (baseType.endsWith('[]')) baseType = baseType.slice(0, -2)

  // Handle threshold syntax (Type(0.8) or malformed Type(0.8)
  // Match either complete threshold (Type(0.8)) or incomplete (Type(0.8)
  const incompleteThresholdMatch = baseType.match(/^([A-Za-z][A-Za-z0-9_]*)\([^)]*$/)
  if (incompleteThresholdMatch) {
    // Unclosed parenthesis - this is a malformed threshold
    // The test expects this to parse without error but not extract threshold
    // So we strip the malformed part and use just the type name
    baseType = incompleteThresholdMatch[1]!
  } else {
    const fullThresholdMatch = baseType.match(/^([^(]+)\(([^)]+)\)$/)
    if (fullThresholdMatch) {
      baseType = fullThresholdMatch[1]!
    }
  }

  // Handle backref syntax
  if (baseType.includes('.')) {
    const parts = baseType.split('.')
    const [typePart, backrefPart] = parts
    baseType = typePart!

    // Validate backref name
    if (backrefPart && !VALID_FIELD_NAME_PATTERN.test(backrefPart)) {
      throw new SchemaValidationError(
        `Invalid backref name '${backrefPart}' in operator target '${targetType}' for field '${fieldName}': must start with a letter or underscore.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }

    // Check for multiple dots
    if (parts.length > 2) {
      throw new SchemaValidationError(
        `Invalid operator target '${targetType}' for field '${fieldName}': multiple dots in backref syntax are not allowed.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }
  }

  // Handle union types
  if (baseType.includes('|')) {
    const unionTypes = baseType.split('|').map((t) => t.trim())

    // Check for empty union members
    if (unionTypes.some((t) => !t)) {
      throw new SchemaValidationError(
        `Invalid union type '${targetType}' for field '${fieldName}': empty union members are not allowed.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }

    // Validate each union type
    for (const unionType of unionTypes) {
      if (!/^[A-Z][A-Za-z0-9_]*$/.test(unionType)) {
        throw new SchemaValidationError(
          `Invalid union type '${unionType}' in '${targetType}' for field '${fieldName}': type names must be PascalCase.`,
          'INVALID_OPERATOR',
          fieldName
        )
      }

      // Check for SQL injection in union types
      if (/[;'"`]|--|\bDROP\b|\bSELECT\b|\bUNION\b/i.test(unionType)) {
        throw new SchemaValidationError(
          `Invalid union type '${unionType}' in '${targetType}' for field '${fieldName}': contains potentially dangerous characters.`,
          'INVALID_OPERATOR',
          fieldName
        )
      }
    }
  } else {
    // Single type validation
    // Check for SQL injection
    if (/[;'"`]|--|\bDROP\b|\bSELECT\b|\bUNION\b/i.test(baseType)) {
      throw new SchemaValidationError(
        `Invalid operator target '${targetType}' for field '${fieldName}': contains potentially dangerous characters or SQL keywords.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }

    // Check for XSS
    if (/<[^>]*>|javascript:|onerror|onclick/i.test(baseType)) {
      throw new SchemaValidationError(
        `Invalid operator target '${targetType}' for field '${fieldName}': contains potentially dangerous HTML or JavaScript.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }

    // Validate PascalCase
    if (baseType && !/^[A-Z][A-Za-z0-9_]*$/.test(baseType)) {
      throw new SchemaValidationError(
        `Invalid operator target '${targetType}' for field '${fieldName}': type names must be PascalCase.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }
  }
}

/**
 * Validate operator syntax
 *
 * @param definition - The field definition containing the operator
 * @param fieldName - The field name (for error messages)
 * @throws SchemaValidationError if the operator syntax is invalid
 */
export function validateOperatorSyntax(definition: string, fieldName: string): void {
  // Check for invalid operator combinations
  if (/<>|><|~~>|-->>|<~~/.test(definition)) {
    throw new SchemaValidationError(
      `Invalid operator in field '${fieldName}': '${definition}' contains invalid operator syntax. Valid operators are: ->, ~>, <-, <~.`,
      'INVALID_OPERATOR',
      fieldName
    )
  }

  // Check for empty union members in operator-based definitions
  // Match operator followed by type(s), then check for empty union members
  const operatorMatch = definition.match(/(->|~>|<-|<~)(.+)$/)
  if (operatorMatch) {
    const targetPart = operatorMatch[2]!
    // Strip modifiers (?, []) from end for union validation
    const baseTarget = targetPart
      .replace(/\?$/, '')
      .replace(/\[\]$/, '')
      .replace(/\[\]\?$/, '')
    // Check for trailing pipe, leading pipe, or consecutive pipes
    if (/\|$|\|\||^\|/.test(baseTarget)) {
      throw new SchemaValidationError(
        `Invalid union type '${targetPart}' for field '${fieldName}': empty union members are not allowed.`,
        'INVALID_OPERATOR',
        fieldName
      )
    }
  }
}

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
  // Use graphdl's parseOperator implementation
  const graphdlResult = graphdlParseOperator(definition)
  if (!graphdlResult) return null

  // ai-database's parseField and validateOperatorTarget expect targetType to contain
  // the raw suffix after the operator, including modifiers (?, [], .backref).
  // Extract this directly from the definition rather than reconstructing from
  // graphdl's parsed components. This preserves the original string for validation
  // (e.g., 'User|' with trailing pipe for empty union member detection).
  const operators = ['~>', '<~', '->', '<-'] as const
  let rawTargetType = ''
  for (const op of operators) {
    const opIndex = definition.indexOf(op)
    if (opIndex !== -1) {
      rawTargetType = definition.slice(opIndex + op.length).trim()
      break
    }
  }

  // Handle threshold extraction - graphdl already does this, so strip threshold from rawTargetType
  // to maintain consistency with the original implementation
  if (graphdlResult.threshold !== undefined) {
    // Remove threshold from rawTargetType (e.g., 'Type(0.8)' -> 'Type')
    rawTargetType = rawTargetType.replace(/\([0-9.]+\)/, '')
  } else {
    // Handle malformed threshold syntax (missing closing paren)
    // graphdl strips these internally - we need to do the same for rawTargetType
    // e.g., 'Category(0.8' -> 'Category'
    const malformedThresholdMatch = rawTargetType.match(/^([A-Za-z][A-Za-z0-9_]*)\([^)]*$/)
    if (malformedThresholdMatch) {
      rawTargetType = malformedThresholdMatch[1]!
    }
  }

  const result: OperatorParseResult = {
    operator: graphdlResult.operator,
    direction: graphdlResult.direction,
    matchMode: graphdlResult.matchMode,
    targetType: rawTargetType,
  }
  if (graphdlResult.prompt !== undefined) result.prompt = graphdlResult.prompt
  if (graphdlResult.unionTypes !== undefined) result.unionTypes = graphdlResult.unionTypes
  if (graphdlResult.threshold !== undefined) result.threshold = graphdlResult.threshold
  return result
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

  // Handle seed column mapping syntax: '$.columnName'
  // This maps a source column from seed data to this field
  if (type.startsWith('$.')) {
    const seedColumn = type.slice(2) // Remove '$.' prefix
    return {
      name,
      type: 'string', // Seed fields are stored as strings
      isArray: false,
      isOptional: false,
      isRelation: false,
      seedMapping: seedColumn,
    }
  }

  // Validate operator syntax first (check for invalid operators)
  validateOperatorSyntax(type, name)

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
  if (operatorResult && operatorResult.operator) {
    // Validate the operator target type
    validateOperatorTarget(operatorResult.targetType, operatorResult.operator, name)

    operator = operatorResult.operator
    direction = operatorResult.direction
    matchMode = operatorResult.matchMode
    prompt = operatorResult.prompt
    type = operatorResult.targetType
    unionTypes = operatorResult.unionTypes
  }

  // Check for optional modifier
  // Only treat ? as optional if it doesn't look like a prompt
  // Prompts contain spaces (e.g., 'What are their challenges?')
  // Type definitions don't have spaces (e.g., 'string?', 'Audience?')
  if (type.endsWith('?') && !type.includes(' ')) {
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
    !type.includes(' ') // Type names don't have spaces - strings with spaces are prompts/descriptions
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
  }
  if (relatedType !== undefined) result.relatedType = relatedType
  if (backref !== undefined) result.backref = backref

  // Only add operator properties if an operator was found
  if (operator) {
    result.operator = operator
    if (direction !== undefined) result.direction = direction
    if (matchMode !== undefined) result.matchMode = matchMode
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
    // Validate entity name
    validateEntityName(entityName)

    const fields = new Map<string, ParsedField>()

    for (const [fieldName, fieldDef] of Object.entries(entitySchema)) {
      // Skip metadata fields (prefixed with $) like $fuzzyThreshold, $instructions
      if (fieldName.startsWith('$')) {
        continue
      }

      // Validate field name
      validateFieldName(fieldName, entityName)

      // Validate field definition type
      if (typeof fieldDef !== 'string' && !Array.isArray(fieldDef)) {
        // Object-type field definitions are invalid
        throw new SchemaValidationError(
          `Invalid field type for '${entityName}.${fieldName}': nested objects are not supported. Use a reference to another entity instead.`,
          'INVALID_FIELD_TYPE',
          `${entityName}.${fieldName}`
        )
      }

      // Validate array syntax
      if (Array.isArray(fieldDef)) {
        validateArrayDefinition(fieldDef, fieldName, entityName)
      } else if (!fieldDef.startsWith('$.')) {
        // Validate field type (string definition) - skip seed column mappings
        validateFieldType(fieldDef, fieldName, entityName)
      }

      fields.set(fieldName, parseField(fieldName, fieldDef))
    }

    // Extract seed configuration if $seed is defined
    let seedConfig: SeedConfig | undefined
    const seedUrl = entitySchema['$seed'] as string | undefined
    const seedIdField = entitySchema['$id'] as string | undefined

    if (seedUrl) {
      // Extract the id column from $id field (e.g., '$.oNETSOCCode' -> 'oNETSOCCode')
      const idColumn = seedIdField?.startsWith('$.') ? seedIdField.slice(2) : undefined
      if (!idColumn) {
        throw new SchemaValidationError(
          `Entity '${entityName}' has $seed but missing $id field. Use $id: '$.columnName' to specify the primary key column.`,
          'MISSING_SEED_ID',
          entityName
        )
      }

      // Build field mappings from fields with seedMapping
      const fieldMappings = new Map<string, string>()
      for (const [fieldName, field] of fields) {
        if (field.seedMapping) {
          fieldMappings.set(fieldName, field.seedMapping)
        }
      }

      seedConfig = {
        url: seedUrl,
        idColumn,
        fieldMappings,
      }
    }

    // Store raw schema for accessing metadata like $fuzzyThreshold
    const entityData: ParsedEntity = { name: entityName, fields, schema: entitySchema }
    if (seedConfig !== undefined) entityData.seedConfig = seedConfig
    entities.set(entityName, entityData)
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
          const existingTypes = field.unionTypes.filter((t) => entities.has(t))
          // Validate all union types exist - throw if any non-existent type is found
          if (existingTypes.length > 0) {
            for (const unionType of field.unionTypes) {
              if (unionType !== entityName && !entities.has(unionType)) {
                throw new Error(
                  `Invalid schema: ${entityName}.${fieldName} references non-existent type '${unionType}'`
                )
              }
            }
          } else {
            // None of the union types exist - this is likely a schema error
            // Warn in development, or throw if strict validation is needed
            const missingTypes = field.unionTypes.join('|')
            console.warn(
              `Warning: ${entityName}.${fieldName} union type '${missingTypes}' - ` +
                `none of the specified types exist in the schema. ` +
                `Ensure all union types are defined.`
            )
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
