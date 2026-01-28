/**
 * Error classes for AI primitives
 */

/**
 * Error thrown when a function is not yet implemented.
 *
 * This is used to clearly indicate at runtime that a function exists
 * in the API but does not have a working implementation yet.
 *
 * @example
 * ```ts
 * throw new NotImplementedError('human', 'Human-in-the-loop functions require channel integrations')
 * ```
 */
export class NotImplementedError extends Error {
  /** The name of the function that is not implemented */
  readonly functionName: string

  /** Additional details about why it's not implemented or what's needed */
  readonly details?: string

  constructor(functionName: string, details?: string) {
    const message = details
      ? `Function '${functionName}' is not implemented: ${details}`
      : `Function '${functionName}' is not implemented`
    super(message)
    this.name = 'NotImplementedError'
    this.functionName = functionName
    if (details !== undefined) this.details = details

    // Maintain proper stack trace for where the error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotImplementedError)
    }
  }
}
