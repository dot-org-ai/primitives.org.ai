/**
 * @primitives/db-docs-rels — canonical Drizzle schema for the
 * docs+rels+search+events four-table spine.
 *
 * @packageDocumentation
 */

export * from './custom-types.js'
export * from './schema.js'
export { createMigrationSql, type MigrationOptions } from './migrations/index.js'
