/**
 * Schema Migration Executor
 *
 * Provides utilities for defining and executing schema migrations.
 * Supports forward (up) and backward (down) migrations with operations
 * for adding, removing, renaming fields, and transforming data.
 *
 * @packageDocumentation
 */

import type { DBProvider } from './provider.js'
import { getSchemaVersion, setSchemaVersion } from './version.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Types of migration operations that can be performed
 */
export type MigrationOperationType =
  | 'addEntity'
  | 'removeEntity'
  | 'addField'
  | 'removeField'
  | 'renameField'
  | 'changeType'
  | 'transformData'

/**
 * Base migration operation with type discriminator
 */
interface BaseMigrationOperation {
  type: MigrationOperationType
}

/**
 * Add a new entity type to the schema
 */
export interface AddEntityOperation extends BaseMigrationOperation {
  type: 'addEntity'
  entityName: string
  /** Optional: initial field definitions for documentation */
  fields?: Record<string, string>
}

/**
 * Remove an entity type from the schema
 */
export interface RemoveEntityOperation extends BaseMigrationOperation {
  type: 'removeEntity'
  entityName: string
  /** Optional: whether to delete all existing data */
  deleteData?: boolean
}

/**
 * Add a new field to an entity
 */
export interface AddFieldOperation extends BaseMigrationOperation {
  type: 'addField'
  entityName: string
  fieldName: string
  fieldType: string
  /** Optional: default value for existing entities */
  defaultValue?: unknown
}

/**
 * Remove a field from an entity
 */
export interface RemoveFieldOperation extends BaseMigrationOperation {
  type: 'removeField'
  entityName: string
  fieldName: string
}

/**
 * Rename a field within an entity
 */
export interface RenameFieldOperation extends BaseMigrationOperation {
  type: 'renameField'
  entityName: string
  oldFieldName: string
  newFieldName: string
}

/**
 * Change the type of a field
 */
export interface ChangeTypeOperation extends BaseMigrationOperation {
  type: 'changeType'
  entityName: string
  fieldName: string
  newType: string
  /** Optional: transform function to convert existing data */
  transform?: (oldValue: unknown) => unknown
}

/**
 * Transform data for all entities of a type
 */
export interface TransformDataOperation extends BaseMigrationOperation {
  type: 'transformData'
  entityName: string
  /** Transform function applied to each entity */
  transform: (entity: Record<string, unknown>) => Record<string, unknown>
  /** Optional: filter function to select entities to transform */
  filter?: (entity: Record<string, unknown>) => boolean
}

/**
 * Union of all migration operation types
 */
export type MigrationOperation =
  | AddEntityOperation
  | RemoveEntityOperation
  | AddFieldOperation
  | RemoveFieldOperation
  | RenameFieldOperation
  | ChangeTypeOperation
  | TransformDataOperation

/**
 * A migration definition
 */
export interface Migration {
  /** The version number this migration produces */
  version: number
  /** Human-readable description of what this migration does */
  description: string
  /** Operations to apply the migration (forward) */
  up: MigrationOperation[]
  /** Operations to revert the migration (backward) */
  down: MigrationOperation[]
}

/**
 * Result of running migrations
 */
export interface MigrationResult {
  /** Whether any migrations were run */
  migrationsRun: boolean
  /** The starting version */
  fromVersion: number | null
  /** The ending version */
  toVersion: number
  /** List of migrations that were applied */
  appliedMigrations: number[]
  /** Any errors that occurred */
  errors: Array<{ version: number; error: Error }>
}

// =============================================================================
// Migration Definition Helper
// =============================================================================

/**
 * Define a migration with type safety
 *
 * This helper function ensures the migration object has the correct shape
 * and provides type inference for the operations.
 *
 * @param migration - The migration definition
 * @returns The same migration definition (for chaining)
 *
 * @example
 * ```ts
 * const migration = defineMigration({
 *   version: 2,
 *   description: 'Add email field to User',
 *   up: [
 *     { type: 'addField', entityName: 'User', fieldName: 'email', fieldType: 'string' }
 *   ],
 *   down: [
 *     { type: 'removeField', entityName: 'User', fieldName: 'email' }
 *   ]
 * })
 * ```
 */
export function defineMigration(migration: Migration): Migration {
  // Validate migration structure
  if (typeof migration.version !== 'number' || migration.version < 1) {
    throw new Error(`Migration version must be a positive number, got: ${migration.version}`)
  }

  if (!migration.description || typeof migration.description !== 'string') {
    throw new Error(`Migration version ${migration.version} must have a description`)
  }

  if (!Array.isArray(migration.up)) {
    throw new Error(`Migration version ${migration.version} must have an 'up' operations array`)
  }

  if (!Array.isArray(migration.down)) {
    throw new Error(`Migration version ${migration.version} must have a 'down' operations array`)
  }

  return migration
}

// =============================================================================
// Operation Execution
// =============================================================================

/**
 * Execute a single migration operation
 *
 * @param provider - The database provider
 * @param operation - The operation to execute
 */
async function executeOperation(
  provider: DBProvider,
  operation: MigrationOperation
): Promise<void> {
  switch (operation.type) {
    case 'addEntity': {
      // No action needed - the entity will be created when data is added
      // This operation is primarily for documentation and down migration purposes
      break
    }

    case 'removeEntity': {
      if (operation.deleteData) {
        // Delete all entities of this type
        const entities = await provider.list(operation.entityName)
        for (const entity of entities) {
          const id = (entity['$id'] as string) || (entity['id'] as string)
          if (id) {
            await provider.delete(operation.entityName, id)
          }
        }
      }
      break
    }

    case 'addField': {
      // Update existing entities with the default value
      if (operation.defaultValue !== undefined) {
        const entities = await provider.list(operation.entityName)
        for (const entity of entities) {
          const id = (entity['$id'] as string) || (entity['id'] as string)
          if (id && entity[operation.fieldName] === undefined) {
            await provider.update(operation.entityName, id, {
              [operation.fieldName]: operation.defaultValue,
            })
          }
        }
      }
      break
    }

    case 'removeField': {
      // Remove field from all entities
      const entities = await provider.list(operation.entityName)
      for (const entity of entities) {
        const id = (entity['$id'] as string) || (entity['id'] as string)
        if (id && entity[operation.fieldName] !== undefined) {
          // Create update object without the removed field
          const { [operation.fieldName]: _, ...rest } = entity
          await provider.update(operation.entityName, id, {
            [operation.fieldName]: null, // Set to null to "remove"
          })
        }
      }
      break
    }

    case 'renameField': {
      const entities = await provider.list(operation.entityName)
      for (const entity of entities) {
        const id = (entity['$id'] as string) || (entity['id'] as string)
        if (id && entity[operation.oldFieldName] !== undefined) {
          await provider.update(operation.entityName, id, {
            [operation.newFieldName]: entity[operation.oldFieldName],
            [operation.oldFieldName]: null, // Remove old field
          })
        }
      }
      break
    }

    case 'changeType': {
      const entities = await provider.list(operation.entityName)
      for (const entity of entities) {
        const id = (entity['$id'] as string) || (entity['id'] as string)
        if (id && entity[operation.fieldName] !== undefined) {
          const oldValue = entity[operation.fieldName]
          const newValue = operation.transform ? operation.transform(oldValue) : oldValue
          await provider.update(operation.entityName, id, {
            [operation.fieldName]: newValue,
          })
        }
      }
      break
    }

    case 'transformData': {
      const entities = await provider.list(operation.entityName)
      for (const entity of entities) {
        // Apply filter if provided
        if (operation.filter && !operation.filter(entity)) {
          continue
        }

        const id = (entity['$id'] as string) || (entity['id'] as string)
        if (id) {
          const transformed = operation.transform(entity)
          // Extract only the changed fields for update
          const updates: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(transformed)) {
            if (key !== '$id' && key !== '$type' && value !== entity[key]) {
              updates[key] = value
            }
          }
          if (Object.keys(updates).length > 0) {
            await provider.update(operation.entityName, id, updates)
          }
        }
      }
      break
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = operation
      throw new Error(`Unknown operation type: ${(_exhaustive as MigrationOperation).type}`)
    }
  }
}

// =============================================================================
// Migration Execution
// =============================================================================

/**
 * Run pending migrations on the database
 *
 * This function:
 * 1. Gets the current schema version from the database
 * 2. Finds all migrations with version > current version
 * 3. Applies them in order
 * 4. Updates the schema version after each successful migration
 *
 * @param provider - The database provider
 * @param migrations - Array of migration definitions
 * @param targetVersion - Optional: specific version to migrate to
 * @returns Result of the migration run
 *
 * @example
 * ```ts
 * const migrations = [
 *   defineMigration({
 *     version: 1,
 *     description: 'Initial schema',
 *     up: [],
 *     down: []
 *   }),
 *   defineMigration({
 *     version: 2,
 *     description: 'Add email to User',
 *     up: [
 *       { type: 'addField', entityName: 'User', fieldName: 'email', fieldType: 'string' }
 *     ],
 *     down: [
 *       { type: 'removeField', entityName: 'User', fieldName: 'email' }
 *     ]
 *   })
 * ]
 *
 * const result = await runMigrations(provider, migrations)
 * console.log(`Migrated from v${result.fromVersion} to v${result.toVersion}`)
 * ```
 */
export async function runMigrations(
  provider: DBProvider,
  migrations: Migration[],
  targetVersion?: number
): Promise<MigrationResult> {
  // Sort migrations by version
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version)

  // Validate version sequence
  for (let i = 0; i < sortedMigrations.length; i++) {
    if (sortedMigrations[i]!.version !== i + 1) {
      throw new Error(
        `Migration versions must be sequential starting from 1. ` +
          `Expected version ${i + 1}, got ${sortedMigrations[i]!.version}`
      )
    }
  }

  // Get current version
  const versionInfo = await getSchemaVersion(provider)
  const currentVersion = versionInfo?.version ?? 0
  const finalTargetVersion =
    targetVersion ?? sortedMigrations[sortedMigrations.length - 1]?.version ?? 0

  const result: MigrationResult = {
    migrationsRun: false,
    fromVersion: currentVersion === 0 ? null : currentVersion,
    toVersion: currentVersion,
    appliedMigrations: [],
    errors: [],
  }

  // Determine direction
  if (finalTargetVersion > currentVersion) {
    // Forward migration
    for (const migration of sortedMigrations) {
      if (migration.version <= currentVersion) continue
      if (migration.version > finalTargetVersion) break

      try {
        // Execute all up operations
        for (const operation of migration.up) {
          await executeOperation(provider, operation)
        }

        // Update version after successful migration
        await setSchemaVersion(
          provider,
          migration.version,
          `v${migration.version}`,
          migration.description
        )

        result.appliedMigrations.push(migration.version)
        result.toVersion = migration.version
        result.migrationsRun = true
      } catch (error) {
        result.errors.push({
          version: migration.version,
          error: error instanceof Error ? error : new Error(String(error)),
        })
        // Stop on first error
        break
      }
    }
  } else if (finalTargetVersion < currentVersion) {
    // Backward migration (rollback)
    const reversedMigrations = [...sortedMigrations].reverse()

    for (const migration of reversedMigrations) {
      if (migration.version > currentVersion) continue
      if (migration.version <= finalTargetVersion) break

      try {
        // Execute all down operations
        for (const operation of migration.down) {
          await executeOperation(provider, operation)
        }

        // Update version after successful rollback
        const newVersion = migration.version - 1
        await setSchemaVersion(
          provider,
          newVersion,
          `v${newVersion}`,
          `Rolled back from v${migration.version}`
        )

        result.appliedMigrations.push(migration.version)
        result.toVersion = newVersion
        result.migrationsRun = true
      } catch (error) {
        result.errors.push({
          version: migration.version,
          error: error instanceof Error ? error : new Error(String(error)),
        })
        // Stop on first error
        break
      }
    }
  }

  return result
}

/**
 * Get pending migrations that need to be run
 *
 * @param provider - The database provider
 * @param migrations - Array of migration definitions
 * @returns Array of migrations that haven't been applied yet
 */
export async function getPendingMigrations(
  provider: DBProvider,
  migrations: Migration[]
): Promise<Migration[]> {
  const versionInfo = await getSchemaVersion(provider)
  const currentVersion = versionInfo?.version ?? 0

  return migrations.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version)
}

/**
 * Rollback the last applied migration
 *
 * @param provider - The database provider
 * @param migrations - Array of migration definitions
 * @returns Result of the rollback
 */
export async function rollbackLastMigration(
  provider: DBProvider,
  migrations: Migration[]
): Promise<MigrationResult> {
  const versionInfo = await getSchemaVersion(provider)
  const currentVersion = versionInfo?.version ?? 0

  if (currentVersion === 0) {
    return {
      migrationsRun: false,
      fromVersion: null,
      toVersion: 0,
      appliedMigrations: [],
      errors: [],
    }
  }

  return runMigrations(provider, migrations, currentVersion - 1)
}
