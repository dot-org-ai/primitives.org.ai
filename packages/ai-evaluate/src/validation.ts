/**
 * Input validation for EvaluateOptions
 *
 * Validates options to prevent resource exhaustion and provide clear error messages.
 */

import type { EvaluateOptions } from './types.js'

/**
 * The key under which the ai-tests service binding is handed to the loaded
 * worker (`env.TEST` in the generated template, RPC runner only). Reserved:
 * neither `env` nor `bindings` may use it.
 */
export const TEST_BINDING_KEY = 'TEST'

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

/**
 * Whether a value looks like a Workers RPC stub: a service binding, a
 * `WorkerEntrypoint` stub (`ctx.exports.X`, a `Fetcher`), a Durable Object
 * stub - anything that carries a `fetch` method. Such stubs are the only
 * non-cloneable values the Dynamic Workers loader accepts in a worker's `env`,
 * and the only ones the sandbox forwards: an RPC stub hands the isolate a
 * capability, never the host's raw binding.
 */
export function isRpcStubLike(value: unknown): boolean {
  if (value === null) return false
  if (typeof value !== 'object' && typeof value !== 'function') return false
  return typeof (value as { fetch?: unknown }).fetch === 'function'
}

/**
 * Whether `structuredClone` accepts the value. Host bindings (KV, D1, R2,
 * Durable Object namespaces) and functions all throw `DataCloneError`.
 */
export function isStructuredCloneable(value: unknown): boolean {
  try {
    structuredClone(value)
    return true
  } catch {
    return false
  }
}

/**
 * Build the loaded worker's `env` from `options.env` (strings) and
 * `options.bindings` (RPC stubs and structured-cloneable values), validating
 * every value. This is the allowlist that keeps host bindings out of the
 * isolate: a value that is neither a string, an RPC stub nor cloneable never
 * reaches the loader.
 *
 * @throws ValidationError for a non-string `env` value, a `bindings` value
 *   that is neither an RPC stub nor structured-cloneable, a key present in
 *   both, or the reserved `TEST` key.
 */
export function buildSandboxEnv(options: EvaluateOptions): Record<string, unknown> {
  const sandboxEnv: Record<string, unknown> = {}
  const { env, bindings } = options

  if (env !== undefined && env !== null) {
    if (typeof env !== 'object' || Array.isArray(env)) {
      throw new ValidationError('env must be an object of string values')
    }
    for (const [key, value] of Object.entries(env)) {
      if (key === TEST_BINDING_KEY) {
        throw new ValidationError(
          `env.${key} is reserved for the ai-tests service binding; choose another name`
        )
      }
      if (typeof value !== 'string') {
        throw new ValidationError(
          `env.${key} must be a string (got ${describeValue(
            value
          )}); pass RPC stubs and structured values in bindings`
        )
      }
      sandboxEnv[key] = value
    }
  }

  if (bindings !== undefined && bindings !== null) {
    if (typeof bindings !== 'object' || Array.isArray(bindings)) {
      throw new ValidationError('bindings must be an object')
    }
    for (const [key, value] of Object.entries(bindings)) {
      if (key === TEST_BINDING_KEY) {
        throw new ValidationError(
          `bindings.${key} is reserved for the ai-tests service binding; choose another name`
        )
      }
      if (key in sandboxEnv) {
        throw new ValidationError(`${key} is set in both env and bindings; use one`)
      }
      if (!isRpcStubLike(value) && !isStructuredCloneable(value)) {
        throw new ValidationError(
          `bindings.${key} is not structured-cloneable and not an RPC stub (got ${describeValue(
            value
          )}); ` +
            'a raw KV/D1/R2/Durable Object binding or a function cannot be handed to the sandbox - ' +
            'wrap it in a WorkerEntrypoint service and pass that stub'
        )
      }
      sandboxEnv[key] = value
    }
  }

  return sandboxEnv
}

/** A short description of a value for error messages, never its contents */
function describeValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return typeof value
  const tag = Object.prototype.toString.call(value).slice(8, -1)
  const name = (value as { constructor?: { name?: string } }).constructor?.name
  return name && name !== 'Object' ? name : tag
}
