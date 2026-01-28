/**
 * Digital Objects Provider for ai-database
 *
 * This module provides a wrapper that uses digital-objects as a storage backend
 * for ai-database. It creates a MemoryProvider from digital-objects and wraps it
 * with the DBProviderAdapter to provide the ai-database DBProvider interface.
 *
 * @example
 * ```ts
 * import { DB } from 'ai-database'
 * import { createDigitalObjectsProvider } from 'ai-database'
 *
 * const provider = createDigitalObjectsProvider()
 *
 * const { db } = DB({
 *   User: {
 *     name: 'string',
 *     email: 'string',
 *   }
 * }, { provider })
 *
 * await db.User.create({ name: 'John', email: 'john@example.com' })
 * ```
 *
 * @packageDocumentation
 */

import { createDBProviderAdapter, createMemoryProvider } from 'digital-objects'
import type { DBProvider } from './schema/provider.js'

/**
 * Creates a DBProvider backed by digital-objects storage.
 *
 * This function creates an in-memory DigitalObjectsProvider and wraps it
 * with the DBProviderAdapter to provide the ai-database DBProvider interface.
 *
 * @returns A DBProvider that uses digital-objects as the storage backend
 *
 * @example
 * ```ts
 * const provider = createDigitalObjectsProvider()
 *
 * // Use with DB factory
 * const { db } = DB(schema, { provider })
 *
 * // Or use directly
 * await provider.create('User', 'user-1', { name: 'John' })
 * const user = await provider.get('User', 'user-1')
 * ```
 */
export function createDigitalObjectsProvider(): DBProvider {
  // Create a MemoryProvider from digital-objects
  const memoryProvider = createMemoryProvider()

  // Wrap it with the DBProviderAdapter to get DBProvider interface
  const dbProvider = createDBProviderAdapter(memoryProvider)

  return dbProvider
}
