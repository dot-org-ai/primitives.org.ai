/**
 * @primitives/content-derived-id
 *
 * Canonical sha256-prefix-12 content-derived ID generator. Locks the ID
 * shape across icps + services-builder + startup-builder so the three
 * repos share a single address space without birthday collisions or
 * silent format drift.
 *
 * See README.md for the full spec + collision math + migration plan.
 */

export { deriveContentId, deriveContentHash, type DeriveOpts, type Prefix } from './derive.js'

export { canonicalize } from './canonical-json.js'

export { migrateFromFnv1a, migrateFromFnv1aBatch, type MigrateResult } from './migrate.js'
