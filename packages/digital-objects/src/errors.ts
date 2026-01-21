/**
 * Standardized error classes for digital-objects
 *
 * These errors provide consistent error handling across all providers
 * (MemoryProvider, NS Durable Object) with proper HTTP status codes.
 */

/**
 * Base error class for all digital-objects errors
 */
export class DigitalObjectsError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message)
    this.name = 'DigitalObjectsError'
  }
}

/**
 * Thrown when a resource is not found
 */
export class NotFoundError extends DigitalObjectsError {
  constructor(type: string, id: string) {
    super(`${type} not found: ${id}`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when validation fails
 */
export class ValidationError extends DigitalObjectsError {
  constructor(message: string, public errors: Array<{ field: string; message: string }>) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

/**
 * Thrown when there's a conflict (e.g., duplicate ID)
 */
export class ConflictError extends DigitalObjectsError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
  }
}

/**
 * Thrown when a server error occurs (5xx status codes)
 */
export class ServerError extends DigitalObjectsError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'SERVER_ERROR', statusCode)
    this.name = 'ServerError'
  }
}

/**
 * Thrown when a network error occurs (connection refused, timeout, etc.)
 */
export class NetworkError extends DigitalObjectsError {
  constructor(message: string, public override cause?: Error) {
    super(message, 'NETWORK_ERROR', 503)
    this.name = 'NetworkError'
  }
}

/**
 * Convert an error to an HTTP-safe JSON response body
 */
export function errorToResponse(error: unknown): { body: object; status: number } {
  if (error instanceof DigitalObjectsError) {
    return {
      body: {
        error: error.code,
        message: error.message,
        ...(error instanceof ValidationError ? { errors: error.errors } : {}),
      },
      status: error.statusCode,
    }
  }

  // Don't expose internal error details to clients
  return {
    body: {
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
    status: 500,
  }
}
