/**
 * Input validation for EvaluateOptions
 *
 * Validates options to prevent resource exhaustion and provide clear error messages.
 */

import type { EvaluateOptions } from './types.js'

/**
 * Validation limits for EvaluateOptions
 */
export const MAX_SCRIPT_SIZE = 1024 * 1024 // 1MB
export const MAX_IMPORTS = 100
export const MAX_TIMEOUT = 60000 // 60 seconds
export const DEFAULT_TIMEOUT = 5000 // 5 seconds

/**
 * Validation error thrown when options fail validation
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate a URL string
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate EvaluateOptions
 *
 * @throws ValidationError if any validation fails
 */
export function validateOptions(options: EvaluateOptions): void {
  // Validate timeout
  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number') {
      throw new ValidationError('timeout must be a number')
    }
    if (!Number.isFinite(options.timeout)) {
      throw new ValidationError('timeout must be a finite number')
    }
    if (options.timeout <= 0) {
      throw new ValidationError('timeout must be a positive number')
    }
    if (options.timeout > MAX_TIMEOUT) {
      throw new ValidationError(`timeout exceeds maximum allowed value of ${MAX_TIMEOUT}ms`)
    }
  }

  // Validate script length
  if (options.script !== undefined && options.script !== null) {
    if (typeof options.script !== 'string') {
      throw new ValidationError('script must be a string')
    }
    const scriptBytes = new TextEncoder().encode(options.script).length
    if (scriptBytes > MAX_SCRIPT_SIZE) {
      throw new ValidationError(
        `script size (${scriptBytes} bytes) exceeds maximum allowed size of ${MAX_SCRIPT_SIZE} bytes (1MB)`
      )
    }
  }

  // Validate module length
  if (options.module !== undefined && options.module !== null) {
    if (typeof options.module !== 'string') {
      throw new ValidationError('module must be a string')
    }
    const moduleBytes = new TextEncoder().encode(options.module).length
    if (moduleBytes > MAX_SCRIPT_SIZE) {
      throw new ValidationError(
        `module size (${moduleBytes} bytes) exceeds maximum allowed size of ${MAX_SCRIPT_SIZE} bytes (1MB)`
      )
    }
  }

  // Validate tests length
  if (options.tests !== undefined && options.tests !== null) {
    if (typeof options.tests !== 'string') {
      throw new ValidationError('tests must be a string')
    }
    const testsBytes = new TextEncoder().encode(options.tests).length
    if (testsBytes > MAX_SCRIPT_SIZE) {
      throw new ValidationError(
        `tests size (${testsBytes} bytes) exceeds maximum allowed size of ${MAX_SCRIPT_SIZE} bytes (1MB)`
      )
    }
  }

  // Validate imports
  if (options.imports !== undefined && options.imports !== null) {
    if (!Array.isArray(options.imports)) {
      throw new ValidationError('imports must be an array')
    }
    if (options.imports.length > MAX_IMPORTS) {
      throw new ValidationError(
        `imports count (${options.imports.length}) exceeds maximum allowed count of ${MAX_IMPORTS}`
      )
    }
    for (let i = 0; i < options.imports.length; i++) {
      const importUrl = options.imports[i]
      if (typeof importUrl !== 'string') {
        throw new ValidationError(`imports[${i}] must be a string`)
      }
      if (!isValidUrl(importUrl)) {
        throw new ValidationError(`imports[${i}] is not a valid URL: ${importUrl}`)
      }
    }
  }
}
