/**
 * Tagged template literal utilities
 *
 * Provides support for tagged template syntax across all AI functions:
 * - fn`prompt ${variable}` - template literal syntax
 * - Objects/arrays auto-convert to YAML
 * - Options chaining: fn`prompt`({ model: '...' })
 *
 * @packageDocumentation
 */

import { stringify } from 'yaml'

/**
 * Common options for all AI functions
 */
export interface FunctionOptions {
  /** Model to use (e.g., 'claude-opus-4-5', 'gpt-5-1', 'gemini-3-pro') */
  model?: string
  /** Thinking level: 'none', 'low', 'medium', 'high', or token budget number */
  thinking?: 'none' | 'low' | 'medium' | 'high' | number
  /** Temperature (0-2) */
  temperature?: number
  /** Maximum tokens to generate */
  maxTokens?: number
  /** System prompt */
  system?: string
  /** Processing mode */
  mode?: 'default' | 'background'
}

/**
 * Parse a tagged template literal into a prompt string
 * Objects and arrays are converted to YAML for readability
 */
export function parseTemplate(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, str, i) => {
    const value = values[i]
    if (value === undefined) {
      return result + str
    }

    // Convert objects/arrays to YAML
    if (typeof value === 'object' && value !== null) {
      const yaml = stringify(value).trim()
      return result + str + '\n' + yaml
    }

    // Primitives use toString()
    return result + str + String(value)
  }, '')
}

/**
 * Result type that is both a Promise and can be called with options
 */
export type ChainablePromise<T> = Promise<T> & {
  (options?: FunctionOptions): Promise<T>
}

/**
 * Create a chainable promise that supports both await and options chaining
 */
export function createChainablePromise<T>(
  executor: (options?: FunctionOptions) => Promise<T>,
  defaultOptions?: FunctionOptions
): ChainablePromise<T> {
  // Create the base promise with a no-op catch to prevent unhandled rejection
  // The actual error will still be thrown when .then() or await is called
  const basePromise = executor(defaultOptions)

  // Prevent unhandled rejection warning by attaching a no-op catch
  // This doesn't swallow the error - it just prevents the warning when the
  // promise is not immediately awaited (e.g., when chaining options)
  basePromise.catch(() => {})

  // Create a function that accepts options
  const chainable = ((options?: FunctionOptions) => {
    return executor({ ...defaultOptions, ...options })
  }) as ChainablePromise<T>

  // Make it thenable
  chainable.then = basePromise.then.bind(basePromise)
  chainable.catch = basePromise.catch.bind(basePromise)
  ;(chainable as Promise<T>).finally = basePromise.finally.bind(basePromise)

  return chainable
}

/**
 * Template function signature
 */
export type TemplateFunction<T> = {
  (strings: TemplateStringsArray, ...values: unknown[]): ChainablePromise<T>
  (prompt: string, options?: FunctionOptions): Promise<T>
}

/**
 * Create a function that supports both tagged templates and regular calls
 */
export function createTemplateFunction<T>(
  handler: (prompt: string, options?: FunctionOptions) => Promise<T>
): TemplateFunction<T> {
  function templateFn(
    promptOrStrings: string | TemplateStringsArray,
    ...args: unknown[]
  ): Promise<T> | ChainablePromise<T> {
    // Tagged template literal
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      const prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)
      return createChainablePromise((options) => handler(prompt, options))
    }

    // Regular function call
    return handler(promptOrStrings as string, args[0] as FunctionOptions | undefined)
  }

  return templateFn as TemplateFunction<T>
}

/**
 * Create a function with batch support
 */
export interface BatchableFunction<T, TInput = string> extends TemplateFunction<T> {
  batch: (inputs: TInput[]) => Promise<T[]>
}

/**
 * Add batch capability to a template function
 */
export function withBatch<T, TInput = string>(
  fn: TemplateFunction<T>,
  batchHandler: (inputs: TInput[]) => Promise<T[]>
): BatchableFunction<T, TInput> {
  const batchable = fn as BatchableFunction<T, TInput>
  batchable.batch = batchHandler
  return batchable
}

/**
 * Create an async iterable from a streaming generator
 */
export function createAsyncIterable<T>(items: T[] | (() => AsyncGenerator<T>)): AsyncIterable<T> {
  if (Array.isArray(items)) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const item of items) {
          yield item
        }
      },
    }
  }
  return {
    [Symbol.asyncIterator]: items,
  }
}

/**
 * Create a result that is both a Promise (resolves to array) and AsyncIterable (streams items)
 */
export type StreamableList<T> = Promise<T[]> & AsyncIterable<T>

export function createStreamableList<T>(
  getItems: () => Promise<T[]>,
  streamItems?: () => AsyncGenerator<T>
): StreamableList<T> {
  const promise = getItems()

  const asyncIterator = streamItems
    ? streamItems
    : async function* () {
        const items = await promise
        for (const item of items) {
          yield item
        }
      }

  // Create a proper Promise-like object with async iterator
  const result = Object.create(null) as StreamableList<T>

  // Add Promise methods
  Object.defineProperty(result, 'then', {
    value: promise.then.bind(promise),
    writable: false,
    enumerable: false,
  })
  Object.defineProperty(result, 'catch', {
    value: promise.catch.bind(promise),
    writable: false,
    enumerable: false,
  })
  Object.defineProperty(result, 'finally', {
    value: promise.finally.bind(promise),
    writable: false,
    enumerable: false,
  })

  // Add async iterator
  Object.defineProperty(result, Symbol.asyncIterator, {
    value: asyncIterator,
    writable: false,
    enumerable: false,
  })

  // Add Symbol.toStringTag for Promise compatibility
  Object.defineProperty(result, Symbol.toStringTag, {
    value: 'Promise',
    writable: false,
    enumerable: false,
  })

  return result
}
