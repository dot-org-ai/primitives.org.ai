/**
 * ID generation utilities for request tracking across transports
 */

/**
 * Generate a unique request ID with the specified prefix.
 *
 * Format: `{prefix}_{timestamp}_{random}`
 * - prefix: Customizable identifier (default: 'req')
 * - timestamp: Unix timestamp in milliseconds
 * - random: 9-character base36 random string
 *
 * @example
 * ```ts
 * generateRequestId()      // 'req_1706454932123_k7x3m9n2p'
 * generateRequestId('apr') // 'apr_1706454932123_k7x3m9n2p'
 * ```
 */
export function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
