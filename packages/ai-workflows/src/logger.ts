/**
 * Configurable Logger Interface
 *
 * Provides a pluggable logging abstraction for ai-workflows.
 * By default uses console.log/warn/error, but can be replaced
 * with any logging implementation.
 *
 * @example
 * ```ts
 * import { setLogger, getLogger } from 'ai-workflows'
 *
 * // Use default console logger
 * const logger = getLogger()
 * logger.log('[workflow] Starting', { workflowId: '123' })
 *
 * // Set a custom logger
 * setLogger({
 *   log: (msg, data) => winston.info(msg, data),
 *   warn: (msg, data) => winston.warn(msg, data),
 *   error: (msg, error) => winston.error(msg, { error }),
 * })
 *
 * // Disable logging
 * setLogger({
 *   log: () => {},
 *   warn: () => {},
 *   error: () => {},
 * })
 * ```
 */

/**
 * Logger interface for ai-workflows
 *
 * Implementations must provide log, warn, and error methods.
 * Data parameter is optional and can be any value for context.
 */
export interface Logger {
  /**
   * Log informational messages
   * @param msg - The log message
   * @param data - Optional data for context
   */
  log(msg: string, data?: unknown): void

  /**
   * Log warning messages
   * @param msg - The warning message
   * @param data - Optional data for context
   */
  warn(msg: string, data?: unknown): void

  /**
   * Log error messages
   * @param msg - The error message
   * @param error - Optional error object or data
   */
  error(msg: string, error?: unknown): void
}

/**
 * Default console logger implementation
 *
 * Uses console.log, console.warn, and console.error.
 */
export const consoleLogger: Logger = {
  log(msg: string, data?: unknown): void {
    if (data !== undefined) {
      console.log(msg, data)
    } else {
      console.log(msg)
    }
  },

  warn(msg: string, data?: unknown): void {
    if (data !== undefined) {
      console.warn(msg, data)
    } else {
      console.warn(msg)
    }
  },

  error(msg: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(msg, error)
    } else {
      console.error(msg)
    }
  },
}

/**
 * No-op logger that discards all messages
 *
 * Useful for silencing logs in tests or production.
 */
export const noopLogger: Logger = {
  log(): void {},
  warn(): void {},
  error(): void {},
}

/**
 * Current logger instance
 * Defaults to consoleLogger
 */
let currentLogger: Logger = consoleLogger

/**
 * Get the current logger instance
 *
 * @returns The current Logger implementation
 */
export function getLogger(): Logger {
  return currentLogger
}

/**
 * Set the logger implementation
 *
 * @param logger - The Logger implementation to use
 *
 * @example
 * ```ts
 * // Use a custom logger
 * setLogger({
 *   log: (msg, data) => myLogger.info(msg, data),
 *   warn: (msg, data) => myLogger.warn(msg, data),
 *   error: (msg, error) => myLogger.error(msg, { error }),
 * })
 *
 * // Disable logging
 * setLogger(noopLogger)
 *
 * // Reset to console
 * setLogger(consoleLogger)
 * ```
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger
}

/**
 * Reset the logger to the default console logger
 */
export function resetLogger(): void {
  currentLogger = consoleLogger
}
