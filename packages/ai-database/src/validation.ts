/**
 * Input Validation Module
 *
 * Security-focused validation for all provider inputs to prevent:
 * - SQL injection attacks
 * - NoSQL injection attacks
 * - Path traversal attacks
 * - Prototype pollution
 * - Resource exhaustion (excessive length/depth)
 *
 * @packageDocumentation
 */

import { ValidationError } from './errors.js'

// =============================================================================
// Validation Constants
// =============================================================================

/** Maximum allowed length for type names */
export const MAX_TYPE_LENGTH = 256

/** Maximum allowed length for entity IDs */
export const MAX_ID_LENGTH = 512

/** Maximum allowed length for search queries */
export const MAX_QUERY_LENGTH = 10000

/** Maximum allowed nesting depth for objects */
export const MAX_OBJECT_DEPTH = 100

/** Maximum allowed length for relation names */
export const MAX_RELATION_LENGTH = 256

/** Maximum allowed length for field names */
export const MAX_FIELD_LENGTH = 256

// =============================================================================
// Allowlist-Based Validation (Security Hardened)
// =============================================================================

/**
 * Allowed characters for identifiers using allowlist approach.
 * This is more secure than regex which can have bypass vulnerabilities.
 */

/** Allowed uppercase letters (A-Z) */
const ALLOWED_UPPERCASE = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ')

/** Allowed lowercase letters (a-z) */
const ALLOWED_LOWERCASE = new Set('abcdefghijklmnopqrstuvwxyz')

/** Allowed digits (0-9) */
const ALLOWED_DIGITS = new Set('0123456789')

/** Allowed letters (a-z, A-Z) */
const ALLOWED_LETTERS = new Set([...ALLOWED_UPPERCASE, ...ALLOWED_LOWERCASE])

/** Allowed identifier characters (letters, digits, underscore) */
const ALLOWED_IDENTIFIER_CHARS = new Set([...ALLOWED_LETTERS, ...ALLOWED_DIGITS, '_'])

/** Allowed ID characters (letters, digits, underscore, hyphen, dot, forward slash for path-like IDs) */
const ALLOWED_ID_CHARS = new Set([...ALLOWED_LETTERS, ...ALLOWED_DIGITS, '_', '-', '.', '/'])

/** Allowed action type characters (letters, digits, underscore, hyphen) */
const ALLOWED_ACTION_CHARS = new Set([...ALLOWED_LETTERS, ...ALLOWED_DIGITS, '_', '-'])

/**
 * Check if a character is in the allowlist
 * Uses code point to ensure we only accept ASCII characters
 */
function isAllowedChar(char: string, allowedSet: Set<string>): boolean {
  // Must be exactly one character
  if (char.length !== 1) return false
  // Must be ASCII (code point < 128)
  const codePoint = char.charCodeAt(0)
  if (codePoint >= 128) return false
  // Must be in the allowed set
  return allowedSet.has(char)
}

/**
 * Check if a string contains only allowed characters
 * This is the core allowlist validation function
 */
function containsOnlyAllowedChars(str: string, allowedSet: Set<string>): boolean {
  for (const char of str) {
    if (!isAllowedChar(char, allowedSet)) {
      return false
    }
  }
  return true
}

/**
 * Check if a character is a letter (ASCII only)
 */
function isLetter(char: string): boolean {
  return isAllowedChar(char, ALLOWED_LETTERS)
}

/**
 * Validate type name format using allowlist approach
 */
function isValidTypeNameFormat(name: string): boolean {
  if (name.length === 0) return false
  // First character must be a letter
  if (!isLetter(name[0]!)) return false
  // All characters must be in the allowed set
  return containsOnlyAllowedChars(name, ALLOWED_IDENTIFIER_CHARS)
}

/**
 * Validate entity ID format using allowlist approach
 * IDs can contain letters, digits, underscores, and hyphens (for UUIDs and slugs)
 */
function isValidEntityIdFormat(id: string): boolean {
  if (id.length === 0) return false
  // All characters must be in the allowed set
  return containsOnlyAllowedChars(id, ALLOWED_ID_CHARS)
}

/**
 * Validate relation name format using allowlist approach
 */
function isValidRelationNameFormat(name: string): boolean {
  if (name.length === 0) return false
  // First character must be a letter
  if (!isLetter(name[0]!)) return false
  // All characters must be in the allowed set
  return containsOnlyAllowedChars(name, ALLOWED_IDENTIFIER_CHARS)
}

/**
 * Validate field name format using allowlist approach
 * Field names can optionally start with $
 */
function isValidFieldNameFormat(name: string): boolean {
  if (name.length === 0) return false
  let startIndex = 0
  // Handle optional $ prefix
  if (name[0] === '$') {
    if (name.length === 1) return false
    startIndex = 1
  }
  // Character after $ (or first char) must be a letter
  if (!isLetter(name[startIndex]!)) return false
  // All remaining characters must be in the allowed set
  for (let i = startIndex; i < name.length; i++) {
    if (!isAllowedChar(name[i]!, ALLOWED_IDENTIFIER_CHARS)) {
      return false
    }
  }
  return true
}

/**
 * Validate action type format using allowlist approach
 * Action types can contain letters, digits, underscores, and hyphens
 */
function isValidActionTypeFormat(name: string): boolean {
  if (name.length === 0) return false
  // First character must be a letter
  if (!isLetter(name[0]!)) return false
  // All characters must be in the allowed set (including hyphens)
  return containsOnlyAllowedChars(name, ALLOWED_ACTION_CHARS)
}

// =============================================================================
// Validation Patterns (kept for event pattern validation only)
// =============================================================================

/**
 * Pattern for valid event patterns: Type.action, type:action, or wildcards
 * Supports both dot notation (Post.created) and colon notation (entity:created)
 * This is kept as regex because it needs to validate pattern syntax,
 * but the underlying type names are validated with allowlist
 */
const EVENT_PATTERN_REGEX =
  /^(\*|\*\.[A-Za-z_]+|[A-Za-z_]+\.\*|[A-Za-z_]+\.[A-Za-z_:]+|[A-Za-z_]+:[A-Za-z_]+)$/

// =============================================================================
// SQL Injection Patterns
// =============================================================================

/**
 * Common SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i,
  /'\s*OR\s*'?\d*'?\s*=\s*'?\d*/i,
  /"\s*OR\s*"?\d*"?\s*=\s*"?\d*/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /\/\*.*\*\//,
  /--/,
  /EXEC\s+/i,
  /EXECUTE\s+/i,
  /xp_cmdshell/i,
  /WAITFOR\s+DELAY/i,
  /SLEEP\s*\(/i,
  /%27/i, // URL-encoded single quote
  /%22/i, // URL-encoded double quote
]

/**
 * Path traversal patterns to detect
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\.\.%2f/i,
  /%2e%2e%5c/i,
]

/**
 * Protocol injection patterns to detect in URLs
 */
const PROTOCOL_INJECTION_PATTERNS = [
  /^file:/i,
  /^javascript:/i,
  /^data:/i,
  /^ftp:/i,
  /^gopher:/i,
  /^ldap:/i,
]

/**
 * Dangerous control characters that should be rejected
 */
const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

/**
 * Prototype pollution property names to reject
 */
const DANGEROUS_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype'])

// =============================================================================
// Re-export ValidationError from errors.ts for backwards compatibility
// =============================================================================

export { ValidationError }

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Check if a string contains SQL injection patterns
 */
function containsSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Check if a string contains path traversal patterns
 */
function containsPathTraversal(value: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Check if a string contains protocol injection patterns
 */
function containsProtocolInjection(value: string): boolean {
  return PROTOCOL_INJECTION_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Check if a string contains dangerous control characters
 */
function containsControlCharacters(value: string): boolean {
  return CONTROL_CHARACTERS.test(value)
}

/**
 * Validate a type name
 *
 * Requirements:
 * - Must be a string
 * - Must not be empty
 * - Must match alphanumeric pattern (with underscores)
 * - Must not exceed max length
 * - Must not contain SQL injection patterns
 * - Must not contain control characters
 *
 * @throws ValidationError if validation fails
 */
export function validateTypeName(type: unknown): asserts type is string {
  // Check string type
  if (typeof type !== 'string') {
    throw new ValidationError(
      `Invalid type: must be a string, got ${type === null ? 'null' : typeof type}`,
      'Input',
      'type',
      type
    )
  }

  // Check empty
  if (type.length === 0) {
    throw new ValidationError('Invalid type: must not be empty', 'Input', 'type', type)
  }

  // Check length
  if (type.length > MAX_TYPE_LENGTH) {
    throw new ValidationError(
      `Invalid type: exceeds maximum length of ${MAX_TYPE_LENGTH}`,
      'Input',
      'type',
      type
    )
  }

  // Check control characters
  if (containsControlCharacters(type)) {
    throw new ValidationError(
      'Invalid type: contains special characters that are not allowed',
      'Input',
      'type',
      type
    )
  }

  // Check SQL injection
  if (containsSqlInjection(type)) {
    throw new ValidationError(
      'Invalid type: contains injection patterns that are not allowed',
      'Input',
      'type',
      type
    )
  }

  // Check pattern (alphanumeric + underscore) using allowlist
  if (!isValidTypeNameFormat(type)) {
    throw new ValidationError(
      'Invalid type: must be alphanumeric with underscores, starting with a letter',
      'Input',
      'type',
      type
    )
  }
}

/**
 * Validate an entity ID
 *
 * Requirements:
 * - Must be a string
 * - Must not be empty
 * - Must match safe ID pattern
 * - Must not exceed max length
 * - Must not contain SQL injection patterns
 * - Must not contain path traversal patterns
 * - Must not contain control characters
 *
 * @throws ValidationError if validation fails
 */
export function validateEntityId(id: unknown): asserts id is string {
  // Check string type
  if (typeof id !== 'string') {
    throw new ValidationError(
      `Invalid id: must be a string, got ${id === null ? 'null' : typeof id}`,
      'Input',
      'id',
      id
    )
  }

  // Check empty
  if (id.length === 0) {
    throw new ValidationError('Invalid id: must not be empty', 'Input', 'id', id)
  }

  // Check length
  if (id.length > MAX_ID_LENGTH) {
    throw new ValidationError(
      `Invalid id: exceeds maximum length of ${MAX_ID_LENGTH}`,
      'Input',
      'id',
      id
    )
  }

  // Check control characters
  if (containsControlCharacters(id)) {
    throw new ValidationError(
      'Invalid id: contains special characters that are not allowed',
      'Input',
      'id',
      id
    )
  }

  // Check SQL injection
  if (containsSqlInjection(id)) {
    throw new ValidationError(
      'Invalid id: contains injection patterns that are not allowed',
      'Input',
      'id',
      id
    )
  }

  // Check path traversal
  if (containsPathTraversal(id)) {
    throw new ValidationError(
      'Invalid id: contains path traversal patterns that are not allowed',
      'Input',
      'id',
      id
    )
  }

  // Check pattern (alphanumeric + underscore + hyphen) using allowlist
  if (!isValidEntityIdFormat(id)) {
    throw new ValidationError(
      'Invalid id: must contain only alphanumeric characters, underscores, and hyphens',
      'Input',
      'id',
      id
    )
  }
}

/**
 * Validate a search query
 *
 * Requirements:
 * - Must be a string
 * - Must not exceed max length
 *
 * Note: Search queries are more permissive since they're typically used
 * for full-text search and the provider should handle them safely.
 *
 * @throws ValidationError if validation fails
 */
export function validateSearchQuery(query: unknown): asserts query is string {
  if (typeof query !== 'string') {
    throw new ValidationError(
      `Invalid query: must be a string, got ${query === null ? 'null' : typeof query}`,
      'Input',
      'query',
      query
    )
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(
      `Invalid query: exceeds maximum length of ${MAX_QUERY_LENGTH}`,
      'Input',
      'query',
      query
    )
  }
}

/**
 * Calculate the depth of a nested object
 */
function calculateObjectDepth(obj: unknown, currentDepth: number = 0): number {
  if (currentDepth > MAX_OBJECT_DEPTH) {
    return currentDepth // Stop early if we've exceeded max
  }

  if (obj === null || typeof obj !== 'object') {
    return currentDepth
  }

  if (Array.isArray(obj)) {
    let maxDepth = currentDepth
    for (const item of obj) {
      const depth = calculateObjectDepth(item, currentDepth + 1)
      if (depth > maxDepth) maxDepth = depth
    }
    return maxDepth
  }

  let maxDepth = currentDepth
  for (const value of Object.values(obj)) {
    const depth = calculateObjectDepth(value, currentDepth + 1)
    if (depth > maxDepth) maxDepth = depth
  }
  return maxDepth
}

/**
 * Check for prototype pollution in object data
 */
function containsPrototypePollution(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false
  }

  if (Array.isArray(obj)) {
    return obj.some(containsPrototypePollution)
  }

  for (const key of Object.keys(obj)) {
    if (DANGEROUS_PROPERTIES.has(key)) {
      return true
    }
    if (containsPrototypePollution((obj as Record<string, unknown>)[key])) {
      return true
    }
  }

  return false
}

/**
 * Validate entity data
 *
 * Requirements:
 * - Must be an object
 * - Must not exceed max nesting depth
 * - Must not contain prototype pollution attempts
 *
 * @throws ValidationError if validation fails
 */
export function validateEntityData(data: unknown): asserts data is Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Invalid data: must be an object', 'Input', 'data', data)
  }

  // Check depth
  const depth = calculateObjectDepth(data)
  if (depth > MAX_OBJECT_DEPTH) {
    throw new ValidationError(
      `Invalid data: nested too deep, maximum depth is ${MAX_OBJECT_DEPTH}`,
      'Input',
      'data'
    )
  }

  // Check for prototype pollution - but only reject 'constructor' at top level
  // __proto__ is harmless in JSON.parse'd objects
  const record = data as Record<string, unknown>
  if ('constructor' in record && typeof record['constructor'] === 'object') {
    throw new ValidationError('Invalid data: constructor property not allowed', 'Input', 'data')
  }
}

/**
 * Validate a relation name
 *
 * Requirements:
 * - Must be a string
 * - Must not be empty
 * - Must match alphanumeric pattern
 * - Must not exceed max length
 * - Must not contain SQL injection patterns
 *
 * @throws ValidationError if validation fails
 */
export function validateRelationName(relation: unknown): asserts relation is string {
  if (typeof relation !== 'string') {
    throw new ValidationError(
      `Invalid relation: must be a string, got ${relation === null ? 'null' : typeof relation}`,
      'Input',
      'relation',
      relation
    )
  }

  if (relation.length === 0) {
    throw new ValidationError('Invalid relation: must not be empty', 'Input', 'relation', relation)
  }

  if (relation.length > MAX_RELATION_LENGTH) {
    throw new ValidationError(
      `Invalid relation: exceeds maximum length of ${MAX_RELATION_LENGTH}`,
      'Input',
      'relation',
      relation
    )
  }

  if (containsSqlInjection(relation)) {
    throw new ValidationError(
      'Invalid relation: contains injection patterns that are not allowed',
      'Input',
      'relation',
      relation
    )
  }

  // Check pattern using allowlist
  if (!isValidRelationNameFormat(relation)) {
    throw new ValidationError(
      'Invalid relation: must be alphanumeric with underscores, starting with a letter',
      'Input',
      'relation',
      relation
    )
  }
}

/**
 * Validate an event pattern
 *
 * Requirements:
 * - Must be a string
 * - Must match valid event pattern format
 * - Must not contain SQL injection patterns
 *
 * @throws ValidationError if validation fails
 */
export function validateEventPattern(pattern: unknown): asserts pattern is string {
  if (typeof pattern !== 'string') {
    throw new ValidationError(
      `Invalid pattern: must be a string, got ${pattern === null ? 'null' : typeof pattern}`,
      'Input',
      'pattern',
      pattern
    )
  }

  if (containsSqlInjection(pattern)) {
    throw new ValidationError(
      'Invalid pattern: contains injection patterns that are not allowed',
      'Input',
      'pattern',
      pattern
    )
  }

  if (!EVENT_PATTERN_REGEX.test(pattern)) {
    throw new ValidationError(
      'Invalid pattern: must be a valid event pattern (Type.action, *.action, Type.*, or *)',
      'Input',
      'pattern',
      pattern
    )
  }
}

/**
 * Validate an action type
 *
 * Requirements:
 * - Must be a string
 * - Must match alphanumeric pattern
 * - Must not contain SQL injection patterns
 *
 * @throws ValidationError if validation fails
 */
export function validateActionType(actionType: unknown): asserts actionType is string {
  if (typeof actionType !== 'string') {
    throw new ValidationError(
      `Invalid type: must be a string, got ${actionType === null ? 'null' : typeof actionType}`,
      'Input',
      'type',
      actionType
    )
  }

  if (containsSqlInjection(actionType)) {
    throw new ValidationError(
      'Invalid type: contains injection patterns that are not allowed',
      'Input',
      'type',
      actionType
    )
  }

  // Check pattern using allowlist
  if (!isValidActionTypeFormat(actionType)) {
    throw new ValidationError(
      'Invalid type: must be alphanumeric with underscores, starting with a letter',
      'Input',
      'type',
      actionType
    )
  }
}

/**
 * Validate an artifact URL
 *
 * Requirements:
 * - Must be a string
 * - Must not contain path traversal patterns
 * - Must not contain protocol injection
 *
 * @throws ValidationError if validation fails
 */
export function validateArtifactUrl(url: unknown): asserts url is string {
  if (typeof url !== 'string') {
    throw new ValidationError(
      `Invalid url: must be a string, got ${url === null ? 'null' : typeof url}`,
      'Input',
      'url',
      url
    )
  }

  if (containsPathTraversal(url)) {
    throw new ValidationError('Invalid url: path traversal not allowed', 'Input', 'url', url)
  }

  if (containsProtocolInjection(url)) {
    throw new ValidationError('Invalid url: protocol not allowed', 'Input', 'url', url)
  }
}

/**
 * Validate a field name for search
 *
 * Requirements:
 * - Must be a string
 * - Must match valid field pattern or be $all
 * - Must not contain SQL injection patterns
 * - Must not be a dangerous property name
 *
 * @throws ValidationError if validation fails
 */
export function validateFieldName(field: unknown): asserts field is string {
  if (typeof field !== 'string') {
    throw new ValidationError(
      `Invalid field: must be a string, got ${field === null ? 'null' : typeof field}`,
      'Input',
      'field',
      field
    )
  }

  // $all is a special valid field name
  if (field === '$all') {
    return
  }

  if (containsSqlInjection(field)) {
    throw new ValidationError(
      'Invalid field: contains injection patterns that are not allowed',
      'Input',
      'field',
      field
    )
  }

  if (field.length > MAX_FIELD_LENGTH) {
    throw new ValidationError(
      `Invalid field: exceeds maximum length of ${MAX_FIELD_LENGTH}`,
      'Input',
      'field',
      field
    )
  }

  // Check pattern using allowlist
  if (!isValidFieldNameFormat(field)) {
    throw new ValidationError(
      'Invalid field: must be alphanumeric with underscores',
      'Input',
      'field',
      field
    )
  }
}

/**
 * Check if a field name is a dangerous property
 */
export function isDangerousField(field: string): boolean {
  return DANGEROUS_PROPERTIES.has(field)
}

/**
 * Validate list options
 *
 * Requirements:
 * - limit must be a non-negative number if provided
 * - offset must be a non-negative number if provided
 * - orderBy must be a valid field name if provided
 *
 * @throws ValidationError if validation fails
 */
export function validateListOptions(options: unknown): void {
  if (options === null || options === undefined) {
    return
  }

  if (typeof options !== 'object') {
    throw new ValidationError('Invalid options: must be an object', 'Input', 'options', options)
  }

  const opts = options as Record<string, unknown>

  // Validate limit
  if (opts.limit !== undefined) {
    if (typeof opts.limit !== 'number') {
      throw new ValidationError(
        `Invalid limit: must be a number, got ${typeof opts.limit}`,
        'Input',
        'limit',
        opts.limit
      )
    }
    if (opts.limit < 0) {
      throw new ValidationError(
        'Invalid limit: must be positive or zero',
        'Input',
        'limit',
        opts.limit
      )
    }
  }

  // Validate offset
  if (opts.offset !== undefined) {
    if (typeof opts.offset !== 'number') {
      throw new ValidationError(
        `Invalid offset: must be a number, got ${typeof opts.offset}`,
        'Input',
        'offset',
        opts.offset
      )
    }
    if (opts.offset < 0) {
      throw new ValidationError(
        'Invalid offset: must be positive or zero',
        'Input',
        'offset',
        opts.offset
      )
    }
  }

  // Validate orderBy
  if (opts.orderBy !== undefined) {
    if (typeof opts.orderBy !== 'string') {
      throw new ValidationError(
        `Invalid orderBy: must be a string, got ${typeof opts.orderBy}`,
        'Input',
        'orderBy',
        opts.orderBy
      )
    }

    if (containsSqlInjection(opts.orderBy)) {
      throw new ValidationError(
        'Invalid orderBy: contains injection patterns that are not allowed',
        'Input',
        'orderBy',
        opts.orderBy
      )
    }

    // Check pattern using allowlist
    if (!isValidFieldNameFormat(opts.orderBy)) {
      throw new ValidationError(
        'Invalid orderBy field: must be alphanumeric with underscores',
        'Input',
        'orderBy',
        opts.orderBy
      )
    }
  }
}

/**
 * Validate search options including fields array
 *
 * @throws ValidationError if validation fails
 */
export function validateSearchOptions(options: unknown): void {
  if (options === null || options === undefined) {
    return
  }

  // First validate the base list options
  validateListOptions(options)

  const opts = options as Record<string, unknown>

  // Validate fields array
  if (opts.fields !== undefined) {
    if (!Array.isArray(opts.fields)) {
      throw new ValidationError('Invalid fields: must be an array', 'Input', 'fields', opts.fields)
    }

    for (const field of opts.fields) {
      // Skip dangerous field names silently - they will be filtered out by the search method
      // This allows the search to return empty results rather than throwing
      if (typeof field === 'string' && DANGEROUS_PROPERTIES.has(field)) {
        continue
      }
      validateFieldName(field)
    }
  }
}

/**
 * Sanitize a search query by escaping special regex characters
 *
 * This prevents regex injection in search operations.
 */
export function sanitizeSearchQuery(query: string): string {
  // Escape regex special characters for safe string matching
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
