/**
 * Configurable Logger for AI Functions
 *
 * Provides a pluggable logging interface that defaults to console but can be
 * configured to use any logging implementation. This allows library consumers
 * to integrate with their own logging infrastructure.
 *
 * @example
 * ```ts
 * import { configureLogger, getLogger } from 'ai-functions'
 *
 * // Use with default console logger
 * const logger = getLogger()
 * logger.warn('Something happened')
 *
 * // Configure a custom logger
 * configureLogger({
 *   debug: (msg, ...args) => myLogger.debug(msg, ...args),
 *   info: (msg, ...args) => myLogger.info(msg, ...args),
 *   warn: (msg, ...args) => myLogger.warn(msg, ...args),
 *   error: (msg, ...args) => myLogger.error(msg, ...args),
 * })
 *
 * // Disable logging entirely
 * configureLogger(null)
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Logger interface that matches the standard console methods.
 *
 * All methods are optional to allow partial implementations.
 * Missing methods will be no-ops when called.
 */
export interface Logger {
  /** Debug level logging (verbose) */
  debug?: (message: string, ...args: unknown[]) => void
  /** Info level logging (general information) */
  info?: (message: string, ...args: unknown[]) => void
  /** Warning level logging (potential issues) */
  warn?: (message: string, ...args: unknown[]) => void
  /** Error level logging (errors and exceptions) */
  error?: (message: string, ...args: unknown[]) => void
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** The logger implementation to use */
  logger?: Logger | null
  /** Minimum log level to output */
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
}

// ============================================================================
// Logger State
// ============================================================================

/** Log level priority (lower = more verbose) */
const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

/** Default console-based logger */
const defaultLogger: Logger = {
  debug: (message: string, ...args: unknown[]) => console.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => console.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args),
}

/** No-op logger for when logging is disabled */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/** Current logger instance */
let currentLogger: Logger = defaultLogger

/** Current minimum log level */
let currentLevel: string = 'warn'

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Configure the global logger for ai-functions.
 *
 * @param config - Logger configuration or just a logger instance
 *
 * @example
 * ```ts
 * // Use a custom logger
 * configureLogger({
 *   logger: {
 *     debug: (msg) => myLogger.debug(msg),
 *     info: (msg) => myLogger.info(msg),
 *     warn: (msg) => myLogger.warn(msg),
 *     error: (msg) => myLogger.error(msg),
 *   },
 *   level: 'info',
 * })
 *
 * // Just set the log level
 * configureLogger({ level: 'debug' })
 *
 * // Disable all logging
 * configureLogger({ logger: null })
 * // or
 * configureLogger({ level: 'silent' })
 *
 * // Reset to defaults
 * configureLogger({})
 * ```
 */
export function configureLogger(config: LoggerConfig | Logger | null): void {
  // Handle null (disable logging)
  if (config === null) {
    currentLogger = noopLogger
    return
  }

  // Handle Logger directly
  if (config && ('debug' in config || 'info' in config || 'warn' in config || 'error' in config)) {
    // Check if it's a Logger (has at least one log method but no 'logger' or 'level' key)
    if (!('logger' in config) && !('level' in config)) {
      currentLogger = config as Logger
      return
    }
  }

  // Handle LoggerConfig
  const loggerConfig = config as LoggerConfig

  if (loggerConfig.logger === null) {
    currentLogger = noopLogger
  } else if (loggerConfig.logger) {
    currentLogger = loggerConfig.logger
  } else if (config === undefined || Object.keys(config as object).length === 0) {
    // Reset to default
    currentLogger = defaultLogger
    currentLevel = 'warn'
    return
  }

  if (loggerConfig.level) {
    currentLevel = loggerConfig.level
  }
}

/**
 * Get the current logger instance.
 *
 * Returns a logger that respects the configured log level.
 * Methods for levels below the configured minimum will be no-ops.
 *
 * @returns Logger instance with level filtering applied
 *
 * @example
 * ```ts
 * const logger = getLogger()
 * logger.warn('This is a warning')
 * logger.error('This is an error', { details: 'foo' })
 * ```
 */
export function getLogger(): Required<Logger> {
  const minLevel = LOG_LEVELS[currentLevel] ?? LOG_LEVELS['warn']!

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (minLevel <= LOG_LEVELS['debug']!) {
        currentLogger.debug?.(message, ...args)
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (minLevel <= LOG_LEVELS['info']!) {
        currentLogger.info?.(message, ...args)
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (minLevel <= LOG_LEVELS['warn']!) {
        currentLogger.warn?.(message, ...args)
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (minLevel <= LOG_LEVELS['error']!) {
        currentLogger.error?.(message, ...args)
      }
    },
  }
}

/**
 * Reset the logger to default configuration.
 *
 * Restores the console-based logger with 'warn' minimum level.
 */
export function resetLogger(): void {
  currentLogger = defaultLogger
  currentLevel = 'warn'
}

/**
 * Get the current log level
 */
export function getLogLevel(): string {
  return currentLevel
}

/**
 * Set the minimum log level
 *
 * @param level - Minimum level to log ('debug' | 'info' | 'warn' | 'error' | 'silent')
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'silent'): void {
  currentLevel = level
}
