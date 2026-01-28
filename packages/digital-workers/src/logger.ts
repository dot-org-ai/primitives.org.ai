/**
 * Logger Interface for Digital Workers
 *
 * Provides a simple, extensible logging interface that can be injected
 * into components for error logging and debugging. Consumers can provide
 * their own logger implementation (e.g., winston, pino, console).
 *
 * @packageDocumentation
 */

/**
 * Logger interface for structured logging
 *
 * @example
 * ```typescript
 * // Using with console
 * const consoleLogger: Logger = {
 *   debug: (msg, meta) => console.debug(msg, meta),
 *   info: (msg, meta) => console.info(msg, meta),
 *   warn: (msg, meta) => console.warn(msg, meta),
 *   error: (msg, error, meta) => console.error(msg, error, meta),
 * }
 *
 * // Using with a custom logger
 * const customLogger: Logger = {
 *   debug: (msg, meta) => myLogger.debug({ message: msg, ...meta }),
 *   info: (msg, meta) => myLogger.info({ message: msg, ...meta }),
 *   warn: (msg, meta) => myLogger.warn({ message: msg, ...meta }),
 *   error: (msg, error, meta) => myLogger.error({ message: msg, error, ...meta }),
 * }
 * ```
 */
export interface Logger {
  /**
   * Log debug-level messages
   * @param msg - The log message
   * @param meta - Optional metadata object
   */
  debug(msg: string, meta?: object): void

  /**
   * Log info-level messages
   * @param msg - The log message
   * @param meta - Optional metadata object
   */
  info(msg: string, meta?: object): void

  /**
   * Log warning-level messages
   * @param msg - The log message
   * @param meta - Optional metadata object
   */
  warn(msg: string, meta?: object): void

  /**
   * Log error-level messages
   * @param msg - The log message
   * @param error - Optional error object with stack trace
   * @param meta - Optional metadata object
   */
  error(msg: string, error?: Error, meta?: object): void
}

/**
 * A no-op logger that discards all log messages.
 * Used as a default when no logger is provided.
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Creates a console-based logger for debugging purposes.
 *
 * @example
 * ```typescript
 * const transport = createSlackTransport({
 *   ...config,
 *   logger: createConsoleLogger(),
 * })
 * ```
 */
export function createConsoleLogger(): Logger {
  return {
    debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ''),
    info: (msg, meta) => console.info(`[INFO] ${msg}`, meta ?? ''),
    warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ''),
    error: (msg, error, meta) => console.error(`[ERROR] ${msg}`, error ?? '', meta ?? ''),
  }
}
