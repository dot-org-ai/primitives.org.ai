/**
 * Property string parser for Noun() definitions
 *
 * Parses the string patterns used in Noun definitions:
 * - 'string!'           → required string field
 * - 'string?#'          → optional indexed string
 * - '-> Company.contacts' → forward relationship
 * - '<- Deal.contact[]'   → reverse relationship (array)
 * - 'Lead | Qualified'    → enum
 * - 'Qualified'           → verb declaration (PascalCase)
 * - null                  → disabled CRUD verb
 */

import type { ParsedProperty, FieldModifiers, NounDefinitionInput, PropertyKind } from './noun-types.js'

const RELATIONSHIP_REGEX = /^(.*?)\s*(<-|->|<~|~>)\s*(.+)$/
const ENUM_PIPE_REGEX = /\|/
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z]+$/
const EXPLICIT_ENUM_REGEX = /^enum\(([^)]+)\)/
const DEFAULT_VALUE_REGEX = /=\s*"?([^"]*)"?\s*$/

const KNOWN_TYPES = new Set([
  'string', 'number', 'boolean', 'date', 'datetime', 'json', 'url', 'email', 'id',
  'text', 'int', 'decimal', 'timestamp', 'markdown', 'float', 'uuid', 'ulid',
])

const CRUD_VERBS = new Set(['create', 'update', 'delete'])
const READ_VERBS = new Set(['get', 'find'])

/**
 * Detect if a property value is a verb declaration
 *
 * Verb: lowercase key + PascalCase value + not a known type
 * e.g., qualify: 'Qualified', close: 'Closed'
 */
export function isVerbDeclaration(key: string, value: string): boolean {
  return (
    PASCAL_CASE_REGEX.test(value) &&
    !KNOWN_TYPES.has(value.toLowerCase()) &&
    !/^[A-Z]/.test(key) &&
    !CRUD_VERBS.has(key) &&
    !READ_VERBS.has(key)
  )
}

/**
 * Parse field type modifiers from a type string
 *
 * 'string!'  → { type: 'string', modifiers: { required: true, ... } }
 * 'string?#' → { type: 'string', modifiers: { optional: true, indexed: true, ... } }
 * 'int = 0'  → { type: 'int', defaultValue: '0' }
 */
export function parseFieldModifiers(value: string): {
  type: string
  modifiers: FieldModifiers
  defaultValue?: string | undefined
} {
  let remaining = value.trim()
  let defaultValue: string | undefined

  // Extract default value
  const defaultMatch = remaining.match(DEFAULT_VALUE_REGEX)
  if (defaultMatch?.[1] !== undefined) {
    defaultValue = defaultMatch[1].trim()
    remaining = remaining.replace(DEFAULT_VALUE_REGEX, '').trim()
  }

  // Extract modifiers from the end
  const modifiers: FieldModifiers = {
    required: false,
    optional: false,
    indexed: false,
    unique: false,
    array: false,
  }

  // Check for array suffix
  if (remaining.endsWith('[]')) {
    modifiers.array = true
    remaining = remaining.slice(0, -2)
  }

  // Check for index/unique modifiers (## = unique, # = indexed)
  if (remaining.endsWith('##')) {
    modifiers.unique = true
    modifiers.indexed = true
    remaining = remaining.slice(0, -2)
  } else if (remaining.endsWith('#')) {
    modifiers.indexed = true
    remaining = remaining.slice(0, -1)
  }

  // Check for required/optional (! = required, ? = optional)
  if (remaining.endsWith('!')) {
    modifiers.required = true
    remaining = remaining.slice(0, -1)
  } else if (remaining.endsWith('?')) {
    modifiers.optional = true
    remaining = remaining.slice(0, -1)
  }

  // Handle explicit enum: enum(a,b,c)
  const enumMatch = remaining.match(EXPLICIT_ENUM_REGEX)
  if (enumMatch) {
    remaining = 'enum'
  }

  // Handle decimal(N,M)
  if (remaining.startsWith('decimal')) {
    remaining = 'decimal'
  }

  return { type: remaining, modifiers, defaultValue }
}

/**
 * Parse a relationship string
 *
 * '-> Company.contacts'  → { operator: '->', targetType: 'Company', backref: 'contacts' }
 * '<- Deal.contact[]'    → { operator: '<-', targetType: 'Deal', backref: 'contact', isArray: true }
 */
export function parseRelationship(name: string, value: string): ParsedProperty {
  const match = value.match(RELATIONSHIP_REGEX)
  if (!match) {
    return { name, kind: 'field', type: 'string' }
  }

  const operator = match[2]!
  let targetPart = match[3]!.trim()

  // Check for array suffix
  const isArray = targetPart.endsWith('[]')
  if (isArray) {
    targetPart = targetPart.slice(0, -2)
  }

  // Parse Type.backref
  let targetType: string
  let backref: string | undefined
  const dotIdx = targetPart.indexOf('.')
  if (dotIdx > 0) {
    targetType = targetPart.slice(0, dotIdx)
    backref = targetPart.slice(dotIdx + 1)
  } else {
    targetType = targetPart
  }

  return {
    name,
    kind: 'relationship',
    operator,
    targetType,
    backref,
    isArray,
  }
}

/**
 * Parse an enum string (pipe-separated values)
 *
 * 'Lead | Qualified | Customer' → ['Lead', 'Qualified', 'Customer']
 */
export function parseEnum(name: string, value: string): ParsedProperty {
  const values = value.split('|').map((v) => v.trim())
  return {
    name,
    kind: 'enum',
    enumValues: values,
  }
}

/**
 * Parse a single property from a Noun definition
 */
export function parseProperty(key: string, value: string | null): ParsedProperty {
  // null → disabled CRUD verb
  if (value === null) {
    return { name: key, kind: 'disabled' }
  }

  // Relationship: contains ->, <-, ~>, <~
  if (RELATIONSHIP_REGEX.test(value)) {
    return parseRelationship(key, value)
  }

  // Enum: contains |
  if (ENUM_PIPE_REGEX.test(value) && !value.startsWith('enum(')) {
    return parseEnum(key, value)
  }

  // Explicit enum: enum(a,b,c)
  if (value.startsWith('enum(')) {
    const inner = value.match(EXPLICIT_ENUM_REGEX)
    if (inner?.[1]) {
      const values = inner[1].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
      const { defaultValue } = parseFieldModifiers(value)
      return { name: key, kind: 'enum', enumValues: values, defaultValue }
    }
  }

  // Verb declaration: PascalCase value + lowercase key
  if (isVerbDeclaration(key, value)) {
    return {
      name: key,
      kind: 'verb',
      verbAction: key,
    }
  }

  // Field: parse type + modifiers
  const { type, modifiers, defaultValue } = parseFieldModifiers(value)
  return {
    name: key,
    kind: 'field',
    type,
    modifiers,
    defaultValue,
  }
}

/**
 * Parse a complete Noun definition into categorized properties
 */
export function parseNounDefinition(definition: NounDefinitionInput): {
  fields: Map<string, ParsedProperty>
  relationships: Map<string, ParsedProperty>
  verbDeclarations: Map<string, ParsedProperty>
  disabled: Set<string>
} {
  const fields = new Map<string, ParsedProperty>()
  const relationships = new Map<string, ParsedProperty>()
  const verbDeclarations = new Map<string, ParsedProperty>()
  const disabled = new Set<string>()

  for (const [key, value] of Object.entries(definition)) {
    const parsed = parseProperty(key, value)

    switch (parsed.kind) {
      case 'disabled':
        disabled.add(key)
        break
      case 'relationship':
        relationships.set(key, parsed)
        break
      case 'verb':
        verbDeclarations.set(key, parsed)
        break
      case 'field':
      case 'enum':
        fields.set(key, parsed)
        break
    }
  }

  return { fields, relationships, verbDeclarations, disabled }
}
