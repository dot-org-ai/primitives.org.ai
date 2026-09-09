/**
 * Input validation for EvaluateOptions
 *
 * Validates options to prevent resource exhaustion and provide clear error messages.
 */

import type { EvaluateOptions, FetchConfig } from './types.js'
import { isPackageName, parseImportSpecifier, PACKAGE_JSON_MODULE } from './shared.js'
import { OUTBOUND_JSON_MODULE, OUTBOUND_RPC_CACHED_ERROR } from './outbound.js'
import {
  SANDBOX_HOST_BINDING_KEY,
  SANDBOX_JSON_MODULE,
  facetBindingName,
  isIdentifier,
} from './facets.js'

/**
 * The key under which the ai-tests service binding is handed to the loaded
 * worker (`env.TEST` in the generated template, RPC runner only). Reserved:
 * neither `env` nor `bindings` may use it.
 */
export const TEST_BINDING_KEY = 'TEST'

/** Longest `sandboxId` accepted: it names a Durable Object, and appears in error messages */
export const MAX_SANDBOX_ID_LENGTH = 256

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

/** `YYYY-MM-DD`, the only form the runtime accepts for a compatibility date */
const COMPATIBILITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Whether a module name is one the generated worker uses itself, and so is
 * not available to `options.modules`: the entry, the capnweb sibling, the
 * json modules of the content-addressed spec (package, outbound, sandbox
 * identity), and the prefetched URL imports.
 */
export function isReservedModuleName(name: string): boolean {
  return (
    name === 'worker.js' ||
    name === 'capnweb.js' ||
    name === PACKAGE_JSON_MODULE ||
    name === OUTBOUND_JSON_MODULE ||
    name === SANDBOX_JSON_MODULE ||
    /^__external_\d+__\.js$/.test(name)
  )
}

/** Whether `value` is a well-formed `FetchConfig`: a boolean, null, or host patterns */
export function isFetchConfig(value: unknown): value is FetchConfig {
  if (value === null || typeof value === 'boolean') return true
  return (
    Array.isArray(value) &&
    value.every((host) => typeof host === 'string' && host.length > 0 && !/\s/.test(host))
  )
}

/**
 * Validate a positive, finite number option (a timeout or a resource limit)
 */
function validatePositiveNumber(name: string, value: unknown, max?: number): void {
  if (typeof value !== 'number') {
    throw new ValidationError(`${name} must be a number`)
  }
  if (!Number.isFinite(value)) {
    throw new ValidationError(`${name} must be a finite number`)
  }
  if (value <= 0) {
    throw new ValidationError(`${name} must be a positive number`)
  }
  if (max !== undefined && value > max) {
    throw new ValidationError(`${name} exceeds maximum allowed value of ${max}ms`)
  }
}

/**
 * Validate EvaluateOptions
 *
 * Runs at the top of `evaluate()`, before any transform or loader call, so a
 * malformed option is reported as a `ValidationError` (an error result from
 * `evaluate()`) instead of a runtime error from inside workerd.
 *
 * @throws ValidationError if any validation fails
 */
export function validateOptions(options: EvaluateOptions): void {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new ValidationError('options must be an object')
  }

  // Validate timeout
  if (options.timeout !== undefined) {
    validatePositiveNumber('timeout', options.timeout, MAX_TIMEOUT)
  }

  // outboundRpc is registered per evaluation under a fresh id that is part
  // of the content-addressed spec: 'cached' could never reuse an isolate
  // under it, so the combination fails here rather than silently as 'fresh'
  if (options.outboundRpc !== undefined && options.isolation === 'cached') {
    throw new ValidationError(OUTBOUND_RPC_CACHED_ERROR)
  }

  // Any other value would silently take the cached path (aip-263g.38)
  if (
    options.isolation !== undefined &&
    options.isolation !== 'fresh' &&
    options.isolation !== 'cached'
  ) {
    throw new ValidationError("isolation must be 'fresh' or 'cached'")
  }

  // A malformed `fetch` (a string instead of an array, say) must not fail
  // open to "allow all": the option reaches the host worker as JSON, so the
  // type is no protection for the caller
  if (options.fetch !== undefined && !isFetchConfig(options.fetch)) {
    throw new ValidationError('fetch must be true, false, null or an array of host patterns')
  }

  if (options.outboundRpc !== undefined && typeof options.outboundRpc !== 'function') {
    throw new ValidationError('outboundRpc must be a function')
  }

  if (
    options.jsx !== undefined &&
    (typeof options.jsx !== 'object' || options.jsx === null || Array.isArray(options.jsx))
  ) {
    throw new ValidationError('jsx must be an object')
  }

  // Validate limits (Dynamic Workers resource limits)
  if (options.limits !== undefined && options.limits !== null) {
    if (typeof options.limits !== 'object' || Array.isArray(options.limits)) {
      throw new ValidationError('limits must be an object')
    }
    if ('subrequests' in options.limits) {
      // Not a workerd field: it would be accepted and silently ignored (aip-263g.35)
      throw new ValidationError(
        'limits.subrequests is not a Dynamic Workers limit; use limits.subRequests'
      )
    }
    const { cpuMs, subRequests } = options.limits
    if (cpuMs !== undefined) {
      validatePositiveNumber('limits.cpuMs', cpuMs)
    }
    if (subRequests !== undefined) {
      validatePositiveNumber('limits.subRequests', subRequests)
      if (!Number.isInteger(subRequests)) {
        throw new ValidationError('limits.subRequests must be an integer')
      }
    }
  }

  // Validate compatibility flags
  if (options.compatibilityFlags !== undefined && options.compatibilityFlags !== null) {
    if (!Array.isArray(options.compatibilityFlags)) {
      throw new ValidationError('compatibilityFlags must be an array of strings')
    }
    for (let i = 0; i < options.compatibilityFlags.length; i++) {
      const flag = options.compatibilityFlags[i]
      if (typeof flag !== 'string' || flag.length === 0) {
        throw new ValidationError(`compatibilityFlags[${i}] must be a non-empty string`)
      }
    }
  }

  // Validate compatibility date
  if (options.compatibilityDate !== undefined && options.compatibilityDate !== null) {
    if (
      typeof options.compatibilityDate !== 'string' ||
      !COMPATIBILITY_DATE_PATTERN.test(options.compatibilityDate)
    ) {
      throw new ValidationError('compatibilityDate must be a YYYY-MM-DD string')
    }
  }

  // Validate tails (the stubs themselves are checked by the runtime)
  if (options.tails !== undefined && options.tails !== null) {
    if (!Array.isArray(options.tails)) {
      throw new ValidationError('tails must be an array of tail worker stubs')
    }
    for (let i = 0; i < options.tails.length; i++) {
      if (!isRpcStubLike(options.tails[i])) {
        throw new ValidationError(
          `tails[${i}] is not a tail worker stub (a service binding or WorkerEntrypoint stub)`
        )
      }
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
      // Bare package specifiers (`lodash`, `dayjs@1.11.10`, `@scope/pkg@1.0.0`)
      // are dependencies for the bundler; anything else must be an http(s)
      // URL. `file:`, `ftp:` and malformed strings are rejected.
      if (parseImportSpecifier(importUrl) === null && !isValidUrl(importUrl)) {
        throw new ValidationError(`imports[${i}] is not a valid URL: ${importUrl}`)
      }
    }
  }

  // Validate dependencies (package.json shape: name -> version range)
  if (options.dependencies !== undefined && options.dependencies !== null) {
    if (typeof options.dependencies !== 'object' || Array.isArray(options.dependencies)) {
      throw new ValidationError('dependencies must be an object of package name -> version')
    }
    const entries = Object.entries(options.dependencies)
    if (entries.length > MAX_IMPORTS) {
      throw new ValidationError(
        `dependencies count (${entries.length}) exceeds maximum allowed count of ${MAX_IMPORTS}`
      )
    }
    for (const [name, version] of entries) {
      if (!isPackageName(name)) {
        throw new ValidationError(`dependencies has an invalid package name: ${name}`)
      }
      if (typeof version !== 'string' || version.length === 0 || /\s/.test(version)) {
        throw new ValidationError(
          `dependencies.${name} must be a version or range string (e.g. "4.17.21", "^4")`
        )
      }
    }
  }

  // Validate bundler switch
  if (options.bundler !== undefined && typeof options.bundler !== 'boolean') {
    throw new ValidationError('bundler must be a boolean')
  }

  // Validate modules (extra ES modules of the loaded worker, by name)
  if (options.modules !== undefined && options.modules !== null) {
    if (typeof options.modules !== 'object' || Array.isArray(options.modules)) {
      throw new ValidationError('modules must be an object of module name -> source')
    }
    for (const [name, source] of Object.entries(options.modules)) {
      if (name.length === 0 || name.startsWith('/') || name.split('/').includes('..')) {
        throw new ValidationError(`modules has an invalid module name: ${JSON.stringify(name)}`)
      }
      if (isReservedModuleName(name)) {
        throw new ValidationError(
          `modules.${name} is reserved for the generated worker; choose another name`
        )
      }
      if (typeof source !== 'string') {
        throw new ValidationError(`modules.${name} must be a string of module source`)
      }
      const sourceBytes = new TextEncoder().encode(source).length
      if (sourceBytes > MAX_SCRIPT_SIZE) {
        throw new ValidationError(
          `modules.${name} size (${sourceBytes} bytes) exceeds maximum allowed size of ${MAX_SCRIPT_SIZE} bytes (1MB)`
        )
      }
    }
  }

  // Validate sandboxId (the name of the SandboxHost Durable Object)
  if (options.sandboxId !== undefined && options.sandboxId !== null) {
    if (typeof options.sandboxId !== 'string' || options.sandboxId.length === 0) {
      throw new ValidationError('sandboxId must be a non-empty string')
    }
    if (options.sandboxId.length > MAX_SANDBOX_ID_LENGTH) {
      throw new ValidationError(
        `sandboxId length (${options.sandboxId.length}) exceeds maximum allowed length of ${MAX_SANDBOX_ID_LENGTH}`
      )
    }
  }

  // Validate facet (a Durable Object class of the module, run under the SandboxHost)
  if (options.facet !== undefined && options.facet !== null) {
    const { facet } = options
    if (typeof facet !== 'object' || Array.isArray(facet)) {
      throw new ValidationError('facet must be an object ({ class, id?, binding? })')
    }
    if (!isIdentifier(facet.class)) {
      throw new ValidationError('facet.class must be the name of a class the module exports')
    }
    if (facet.id !== undefined && (typeof facet.id !== 'string' || facet.id.length === 0)) {
      throw new ValidationError('facet.id must be a non-empty string')
    }
    if (facet.binding !== undefined && !isIdentifier(facet.binding)) {
      throw new ValidationError('facet.binding must be an identifier (the env key of the facet)')
    }
    const binding = facetBindingName(facet)
    if (binding === TEST_BINDING_KEY || binding === SANDBOX_HOST_BINDING_KEY) {
      throw new ValidationError(`facet binding ${binding} is reserved; set facet.binding`)
    }
    if (options.env && Object.hasOwn(options.env, binding)) {
      throw new ValidationError(`env.${binding} collides with the facet binding; use another name`)
    }
    if (options.bindings && Object.hasOwn(options.bindings, binding)) {
      throw new ValidationError(
        `bindings.${binding} collides with the facet binding; use another name`
      )
    }
    if (!options.module) {
      throw new ValidationError(`facet.class ${facet.class} needs a module that exports it`)
    }
    if (options.sandboxId === undefined || options.sandboxId === null) {
      throw new ValidationError(
        'facet needs a sandboxId: the identity of the sandbox whose state the facet holds'
      )
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
 *   both, or a reserved key (`TEST`, the `SandboxHost` stub key).
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
      if (key === SANDBOX_HOST_BINDING_KEY) {
        throw new ValidationError(
          `env.${key} is reserved for the SandboxHost stub; choose another name`
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
      if (key === SANDBOX_HOST_BINDING_KEY) {
        throw new ValidationError(
          `bindings.${key} is reserved for the SandboxHost stub; choose another name`
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
