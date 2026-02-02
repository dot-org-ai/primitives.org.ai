/**
 * Configurable Logger Interface
 *
 * Provides a pluggable logging system for production use.
 * By default, logs are disabled (no-op). Users can configure custom loggers
 * for observability integration (e.g., pino, winston, structured logging).
 *
 * @packageDocumentation
 */

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger interface for pluggable logging
 *
 * @example Default (silent) - no logging
 * ```ts
 * // Default behavior - no logs in production
 * const db = DB({ Post: { title: 'string' } })
 * ```
 *
 * @example Console logging
 * ```ts
 * import { setLogger, createConsoleLogger } from 'ai-database'
 *
 * setLogger(createConsoleLogger())
 * ```
 *
 * @example Custom logger (e.g., pino)
 * ```ts
 * import pino from 'pino'
 * import { setLogger } from 'ai-database'
 *
 * const pinoLogger = pino()
 * setLogger({
 *   debug: (msg, ...args) => pinoLogger.debug(msg, ...args),
 *   info: (msg, ...args) => pinoLogger.info(msg, ...args),
 *   warn: (msg, ...args) => pinoLogger.warn(msg, ...args),
 *   error: (msg, ...args) => pinoLogger.error(msg, ...args),
 * })
 * ```
 *
 * @example Structured logging
 * ```ts
 * setLogger({
 *   debug: (msg, ctx) => telemetry.log({ level: 'debug', message: msg, ...ctx }),
 *   info: (msg, ctx) => telemetry.log({ level: 'info', message: msg, ...ctx }),
 *   warn: (msg, ctx) => telemetry.log({ level: 'warn', message: msg, ...ctx }),
 *   error: (msg, ctx) => telemetry.log({ level: 'error', message: msg, ...ctx }),
 * })
 * ```
 */
export interface Logger {
  /** Debug level - verbose information for debugging */
  debug(message: string, ...args: unknown[]): void
  /** Info level - general information */
  info(message: string, ...args: unknown[]): void
  /** Warn level - warnings that don't stop execution */
  warn(message: string, ...args: unknown[]): void
  /** Error level - errors that may affect execution */
  error(message: string, ...args: unknown[]): void
}

// =============================================================================
// Logger Implementations
// =============================================================================

/**
 * No-op logger - all logs are silently discarded
 * This is the default logger for production use.
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Create a console logger
 * Wraps console.log/warn/error with the Logger interface.
 *
 * @param options - Configuration options
 * @param options.minLevel - Minimum log level to output (default: 'debug')
 * @returns A Logger that outputs to console
 *
 * @example
 * ```ts
 * // Log everything
 * setLogger(createConsoleLogger())
 *
 * // Only log warnings and errors
 * setLogger(createConsoleLogger({ minLevel: 'warn' }))
 * ```
 */
export function createConsoleLogger(options?: { minLevel?: LogLevel }): Logger {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  const minLevel = levels[options?.minLevel ?? 'debug']

  return {
    debug: (msg, ...args) => {
      if (levels.debug >= minLevel) {
        console.log(`[ai-database:debug] ${msg}`, ...args)
      }
    },
    info: (msg, ...args) => {
      if (levels.info >= minLevel) {
        console.log(`[ai-database:info] ${msg}`, ...args)
      }
    },
    warn: (msg, ...args) => {
      if (levels.warn >= minLevel) {
        console.warn(`[ai-database:warn] ${msg}`, ...args)
      }
    },
    error: (msg, ...args) => {
      if (levels.error >= minLevel) {
        console.error(`[ai-database:error] ${msg}`, ...args)
      }
    },
  }
}

// =============================================================================
// Global Logger State
// =============================================================================

/**
 * Global logger instance
 * Default is noopLogger (silent) for production use.
 */
let currentLogger: Logger = noopLogger

/**
 * Get the current logger instance
 *
 * @returns The current logger
 */
export function getLogger(): Logger {
  return currentLogger
}

/**
 * Set the global logger instance
 *
 * @param logger - The logger to use, or null to reset to noop
 *
 * @example
 * ```ts
 * import { setLogger, createConsoleLogger } from 'ai-database'
 *
 * // Enable console logging
 * setLogger(createConsoleLogger())
 *
 * // Disable logging
 * setLogger(null)
 * ```
 */
export function setLogger(logger: Logger | null): void {
  currentLogger = logger ?? noopLogger
}

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * Log a debug message
 * @internal
 */
export function logDebug(message: string, ...args: unknown[]): void {
  currentLogger.debug(message, ...args)
}

/**
 * Log an info message
 * @internal
 */
export function logInfo(message: string, ...args: unknown[]): void {
  currentLogger.info(message, ...args)
}

/**
 * Log a warning message
 * @internal
 */
export function logWarn(message: string, ...args: unknown[]): void {
  currentLogger.warn(message, ...args)
}

/**
 * Log an error message
 * @internal
 */
export function logError(message: string, ...args: unknown[]): void {
  currentLogger.error(message, ...args)
}
