/**
 * ai-database / docs-rels — canonical Drizzle schema for the
 * docs+rels+search+events four-table spine on Neon Postgres + pgvector.
 *
 * Consume via the subpath export:
 *
 *   import { createDocsRelsSchema, createMigrationSql } from 'ai-database/docs-rels'
 *
 * `drizzle-orm` is a peer dependency — install it in the consuming app.
 *
 * @packageDocumentation
 */

export * from './custom-types.js'
export * from './schema.js'
export { createMigrationSql, type MigrationOptions } from './migrations/index.js'
