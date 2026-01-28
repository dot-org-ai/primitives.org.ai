/**
 * Error handling utilities for ai-database
 *
 * These utilities help distinguish between expected errors that can be safely
 * ignored and unexpected errors that should be propagated or logged.
 *
 * @packageDocumentation
 */

/**
 * Check if an error is a "not found" error that can be safely ignored
 * when the operation is expected to potentially return nothing.
 */
export function isNotFoundError(error: unknown): boolean {
  // Check for custom EntityNotFoundError class
  if (error && typeof error === 'object' && 'code' in error) {
    if ((error as { code?: string }).code === 'ENTITY_NOT_FOUND') {
      return true
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('no such') ||
      (error as { code?: string }).code === 'NOT_FOUND' ||
      (error as { code?: string }).code === 'SQLITE_NOTFOUND' ||
      (error as { code?: string }).code === 'ENOENT'
    )
  }
  return false
}

/**
 * Check if an error is a duplicate key/entity exists error.
 * These can be safely ignored when creating entities that may already exist.
 */
export function isEntityExistsError(error: unknown): boolean {
  // Check for custom EntityAlreadyExistsError class
  if (error && typeof error === 'object' && 'code' in error) {
    if ((error as { code?: string }).code === 'ENTITY_ALREADY_EXISTS') {
      return true
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('already exists') ||
      message.includes('duplicate key') ||
      message.includes('duplicate entry') ||
      message.includes('unique constraint') ||
      (error as { code?: string }).code === 'DUPLICATE_KEY' ||
      (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (error as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
      (error as { code?: string }).code === 'ER_DUP_ENTRY' ||
      (error as { code?: string }).code === '23505' // PostgreSQL unique violation
    )
  }
  return false
}

/**
 * Check if an error is an expected error that can be safely handled
 * without re-throwing. This includes not found and entity exists errors.
 */
export function isExpectedError(error: unknown): boolean {
  return isNotFoundError(error) || isEntityExistsError(error)
}

/**
 * Custom error class for database operations with context
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public entityType: string,
    public entityId?: string,
    public override cause?: Error
  ) {
    super(`${operation} ${entityType}${entityId ? `/${entityId}` : ''}: ${message}`)
    this.name = 'DatabaseError'
  }
}

/**
 * Wrap an error with database operation context
 */
export function wrapDatabaseError(
  error: unknown,
  operation: string,
  entityType: string,
  entityId?: string
): DatabaseError {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error ? error : undefined
  return new DatabaseError(message, operation, entityType, entityId, cause)
}

// =============================================================================
// Custom Error Classes
// =============================================================================

/**
 * Error thrown when an entity is not found in the database.
 *
 * @example
 * ```ts
 * throw new EntityNotFoundError('User', 'user-123', 'get')
 * // Error: Entity not found: User/user-123 (operation: get)
 * ```
 */
export class EntityNotFoundError extends DatabaseError {
  public readonly code = 'ENTITY_NOT_FOUND'

  constructor(entityType: string, entityId: string, operation: string = 'get', cause?: Error) {
    super('Entity not found', operation, entityType, entityId, cause)
    this.name = 'EntityNotFoundError'
  }
}

/**
 * Error thrown when attempting to create an entity that already exists.
 *
 * @example
 * ```ts
 * throw new EntityAlreadyExistsError('User', 'user-123', 'create')
 * // Error: Entity already exists: User/user-123 (operation: create)
 * ```
 */
export class EntityAlreadyExistsError extends DatabaseError {
  public readonly code = 'ENTITY_ALREADY_EXISTS'

  constructor(entityType: string, entityId: string, operation: string = 'create', cause?: Error) {
    super('Entity already exists', operation, entityType, entityId, cause)
    this.name = 'EntityAlreadyExistsError'
  }
}

/**
 * Error thrown when validation of input data fails.
 *
 * @example
 * ```ts
 * throw new ValidationError('Invalid email format', 'User', 'email', 'not-an-email')
 * // Error: Validation failed for User.email: Invalid email format
 * ```
 */
export class ValidationError extends DatabaseError {
  public readonly code = 'VALIDATION_ERROR'

  constructor(
    message: string,
    entityType: string,
    public readonly field?: string,
    public readonly value?: unknown,
    cause?: Error
  ) {
    const fieldInfo = field ? `.${field}` : ''
    const fullMessage = `Validation failed for ${entityType}${fieldInfo}: ${message}`
    super(fullMessage, 'validate', entityType, undefined, cause)
    this.name = 'ValidationError'
  }
}

/**
 * Error thrown when AI generation fails.
 *
 * @example
 * ```ts
 * throw new AIGenerationError('Failed to generate description', 'Product', 'description', err)
 * // Error: AI generation failed for Product.description: Failed to generate description
 * ```
 */
export class AIGenerationError extends DatabaseError {
  public readonly code = 'AI_GENERATION_ERROR'

  constructor(message: string, entityType: string, public readonly field?: string, cause?: Error) {
    const fieldInfo = field ? `.${field}` : ''
    const fullMessage = `AI generation failed for ${entityType}${fieldInfo}: ${message}`
    super(fullMessage, 'generate', entityType, undefined, cause)
    this.name = 'AIGenerationError'
  }
}

/**
 * Error thrown when semantic search operations fail.
 *
 * @example
 * ```ts
 * throw new SemanticSearchError('Embedding generation failed', 'Product', 'search query', err)
 * // Error: Semantic search failed for Product: Embedding generation failed
 * ```
 */
export class SemanticSearchError extends DatabaseError {
  public readonly code = 'SEMANTIC_SEARCH_ERROR'

  constructor(message: string, entityType: string, public readonly query?: string, cause?: Error) {
    const fullMessage = `Semantic search failed for ${entityType}: ${message}`
    super(fullMessage, 'semanticSearch', entityType, undefined, cause)
    this.name = 'SemanticSearchError'
  }
}

// Re-export CapabilityNotSupportedError for convenience
export {
  CapabilityNotSupportedError,
  isCapabilityNotSupportedError,
} from './provider-capabilities.js'
