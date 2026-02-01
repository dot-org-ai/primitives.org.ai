/**
 * Schema Version Tracking
 *
 * Provides utilities for tracking schema versions, computing schema hashes,
 * and storing/retrieving version metadata from the database.
 *
 * @packageDocumentation
 */

import type { DatabaseSchema } from '../types.js'
import type { DBProvider } from './provider.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Schema version metadata stored in the database
 */
export interface SchemaVersionInfo {
  /** The version number (incremented on each migration) */
  version: number
  /** Hash of the schema structure for change detection */
  schemaHash: string
  /** When this version was applied */
  appliedAt?: string
  /** Description of the migration (if any) */
  description?: string
}

// =============================================================================
// Constants
// =============================================================================

/** Entity type for storing schema metadata */
const SCHEMA_META_TYPE = 'SchemaMeta'

/** ID for the schema version record */
const SCHEMA_VERSION_ID = 'current'

// =============================================================================
// Hash Computation
// =============================================================================

/**
 * Compute a deterministic hash of a database schema
 *
 * The hash is computed by:
 * 1. Sorting entity names alphabetically
 * 2. For each entity, sorting field names alphabetically
 * 3. Creating a normalized JSON representation
 * 4. Computing a hash of the JSON string
 *
 * This ensures the same schema always produces the same hash,
 * regardless of property insertion order in the original object.
 *
 * @param schema - The database schema to hash
 * @returns A hex string hash of the schema
 *
 * @example
 * ```ts
 * const hash = computeSchemaHash({
 *   User: { name: 'string', email: 'string' },
 *   Post: { title: 'string', author: 'User.posts' }
 * })
 * // => '8a7b3c9d...'
 * ```
 */
export function computeSchemaHash(schema: DatabaseSchema): string {
  // Create a normalized representation with sorted keys
  const normalized: Record<string, Record<string, unknown>> = {}

  // Sort entity names
  const entityNames = Object.keys(schema).sort()

  for (const entityName of entityNames) {
    const entitySchema = schema[entityName]!
    const normalizedEntity: Record<string, unknown> = {}

    // Sort field names within each entity
    const fieldNames = Object.keys(entitySchema).sort()

    for (const fieldName of fieldNames) {
      const fieldDef = entitySchema[fieldName]
      // Normalize array definitions to string representation
      if (Array.isArray(fieldDef)) {
        normalizedEntity[fieldName] = `[${fieldDef[0]}]`
      } else {
        normalizedEntity[fieldName] = fieldDef
      }
    }

    normalized[entityName] = normalizedEntity
  }

  // Create JSON string and compute hash
  const jsonString = JSON.stringify(normalized)

  // Simple hash function (djb2 algorithm)
  let hash = 5381
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i)
    hash = ((hash << 5) + hash) ^ char
  }

  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// =============================================================================
// Version Storage
// =============================================================================

/**
 * Get the current schema version from the database
 *
 * Reads the _schema_meta entity to retrieve the current schema version
 * and hash. Returns null if no version has been set yet (first run).
 *
 * @param provider - The database provider
 * @returns The current schema version info, or null if not set
 *
 * @example
 * ```ts
 * const version = await getSchemaVersion(provider)
 * if (version) {
 *   console.log(`Current version: ${version.version}`)
 *   console.log(`Schema hash: ${version.schemaHash}`)
 * } else {
 *   console.log('No schema version set - first run')
 * }
 * ```
 */
export async function getSchemaVersion(provider: DBProvider): Promise<SchemaVersionInfo | null> {
  try {
    const record = await provider.get(SCHEMA_META_TYPE, SCHEMA_VERSION_ID)

    if (!record) {
      return null
    }

    const result: SchemaVersionInfo = {
      version: record['version'] as number,
      schemaHash: record['schemaHash'] as string,
    }
    if (record['appliedAt'] !== undefined) {
      result.appliedAt = record['appliedAt'] as string
    }
    if (record['description'] !== undefined) {
      result.description = record['description'] as string
    }
    return result
  } catch (error) {
    // If the entity type doesn't exist yet, that's fine - return null
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('does not exist'))
    ) {
      return null
    }
    throw error
  }
}

/**
 * Set the schema version in the database
 *
 * Stores the schema version and hash as a _schema_meta entity.
 * Creates the entity if it doesn't exist, or updates it if it does.
 *
 * @param provider - The database provider
 * @param version - The new version number
 * @param schemaHash - The hash of the current schema
 * @param description - Optional description of the migration
 *
 * @example
 * ```ts
 * await setSchemaVersion(provider, 1, 'abc123', 'Initial schema')
 * await setSchemaVersion(provider, 2, 'def456', 'Added email field to User')
 * ```
 */
export async function setSchemaVersion(
  provider: DBProvider,
  version: number,
  schemaHash: string,
  description?: string
): Promise<void> {
  const data: Record<string, unknown> = {
    version,
    schemaHash,
    appliedAt: new Date().toISOString(),
  }

  if (description !== undefined) {
    data['description'] = description
  }

  // Try to get existing record
  const existing = await provider.get(SCHEMA_META_TYPE, SCHEMA_VERSION_ID)

  if (existing) {
    // Update existing record
    await provider.update(SCHEMA_META_TYPE, SCHEMA_VERSION_ID, data)
  } else {
    // Create new record
    await provider.create(SCHEMA_META_TYPE, SCHEMA_VERSION_ID, data)
  }
}

/**
 * Check if the schema has changed since the last recorded version
 *
 * Compares the current schema hash with the stored hash to detect changes.
 *
 * @param provider - The database provider
 * @param schema - The current schema definition
 * @returns Object with changed status and hashes
 *
 * @example
 * ```ts
 * const { changed, currentHash, storedHash } = await hasSchemaChanged(provider, schema)
 * if (changed) {
 *   console.log('Schema has changed, migration may be needed')
 * }
 * ```
 */
export async function hasSchemaChanged(
  provider: DBProvider,
  schema: DatabaseSchema
): Promise<{
  changed: boolean
  currentHash: string
  storedHash: string | null
  storedVersion: number | null
}> {
  const currentHash = computeSchemaHash(schema)
  const versionInfo = await getSchemaVersion(provider)

  return {
    changed: versionInfo === null || versionInfo.schemaHash !== currentHash,
    currentHash,
    storedHash: versionInfo?.schemaHash ?? null,
    storedVersion: versionInfo?.version ?? null,
  }
}
